import os
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import bot
import legal
from cryptography.fernet import Fernet


class LegalTests(unittest.IsolatedAsyncioTestCase):
    def test_documents_and_minimal_consent_audit(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            key=Fernet.generate_key()
            cipher=Fernet(key)
            (root/'bot-consent.key').write_bytes(key)
            for name in legal.URLS:
                (root / (name+'.html')).write_text('<header>Excluded</header><article class="legal-document wrap"><p>'+name+' Правила сервиса. '*15+'</p></article><footer>Excluded</footer>',encoding='utf-8')
            with patch.object(legal,'DOCUMENTS',root), patch.dict(os.environ,{'BOT_CONSENT_DB':str(root/'audit.sqlite3'),'CREDENTIALS_DIRECTORY':str(root)}):
                self.assertNotIn('Excluded',legal.document('privacy'))
                self.assertIn('https://taroway.com/offer/',legal.document_context())
                legal.audit(123,'agree','diagnosis')
                legal.audit(123,'revoke','all')
                with closing(sqlite3.connect(root/'audit.sqlite3')) as db:
                    rows=[json.loads(cipher.decrypt(row[0])) for row in db.execute('SELECT payload FROM consent_events').fetchall()]
                self.assertEqual(['agree','revoke'],[row['action'] for row in rows])
                self.assertEqual(64,len(rows[0]['version']))

    async def test_ai_cannot_run_before_consent(self):
        context=SimpleNamespace(user_data={})
        message=SimpleNamespace(reply_text=AsyncMock())
        with patch.object(bot,'ai',AsyncMock()) as ai:
            await bot.answer_ai(message,context,'Мой вопрос')
            ai.assert_not_awaited()
        self.assertTrue(context.user_data['awaiting_ai_consent'])

    async def test_record_failure_is_closed(self):
        message=SimpleNamespace(reply_text=AsyncMock())
        update=SimpleNamespace(effective_user=SimpleNamespace(id=123),callback_query=SimpleNamespace(message=message))
        with patch.object(bot,'audit',side_effect=OSError('unavailable')):
            self.assertFalse(await bot.record_consent(update,SimpleNamespace(),'diagnosis'))

    async def test_revoke_clears_session(self):
        message=SimpleNamespace(reply_text=AsyncMock())
        context=SimpleNamespace(user_data={'ai_consent':True,'diagnosis':{'name':'Test'}})
        with patch.object(bot,'audit') as audit:
            await bot.revoke(SimpleNamespace(message=message,effective_user=SimpleNamespace(id=123)),context)
        self.assertEqual({},context.user_data)
        audit.assert_called_once_with(123,'revoke','all')

    async def test_diagnosis_asks_age_before_separate_consent(self):
        context=SimpleNamespace(user_data={})
        message=SimpleNamespace(reply_text=AsyncMock())
        await bot.begin_diagnosis(message,context)
        self.assertEqual('age',context.user_data['diagnosis']['step'])
        await bot.diagnosis_consent(message)
        self.assertEqual('✅ Согласен',message.reply_text.call_args.kwargs['reply_markup'].inline_keyboard[0][0].text)


if __name__ == '__main__':
    unittest.main()
