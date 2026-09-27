import json
import time
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import bot
import diagnosis


class DiagnosisTests(unittest.IsolatedAsyncioTestCase):
    def test_dates_and_minor_rejection(self):
        self.assertEqual('1990-02-28', diagnosis.birth_date('28.02.1990'))
        for value in ['31.02.1990', '1990-01-01', '01.01.2030', '01.01.2015']:
            with self.assertRaises(ValueError):
                diagnosis.birth_date(value, date(2026, 9, 27))

    def test_response_contract(self):
        valid = {'sentences':['Есть вопрос.', 'Можно начать с малого.', 'Вы можете искать поддержку.'], 'product':'first'}
        self.assertEqual('first', diagnosis.parse_analysis(json.dumps(valid))[1])
        for invalid in [{**valid, 'product':'invented'}, {**valid, 'sentences':['x']*7}, {**valid, 'sentences':['Один. Два. Три.']*3}]:
            with self.assertRaises(ValueError):
                diagnosis.parse_analysis(json.dumps(invalid))

    async def test_complete_flow_uses_ai_and_clears_answers(self):
        message=SimpleNamespace(reply_text=AsyncMock())
        context=SimpleNamespace(user_data={'diagnosis':{'step':'name','updated':time.monotonic()}}, bot_data={})
        data=context.user_data['diagnosis']
        await bot.diagnosis_text(message,context,'Марина',data)
        self.assertEqual('sphere',data['step'])
        data.update(sphere=diagnosis.SPHERES[0],step='situation')
        for value in ['Хочу понять ситуацию','01.01.1990','Пробовала поговорить']:
            await bot.diagnosis_text(message,context,value,data)
        response=json.dumps({'sentences':['Вы ищете ясность.', 'Начните с небольшого шага.', 'Вы не обязаны решать всё сразу.'], 'product':'clarity'})
        with patch.object(bot,'ai',AsyncMock(return_value=response)) as ai:
            await bot.diagnosis_text(message,context,'Ясность',data)
        ai.assert_awaited_once()
        self.assertNotIn('diagnosis',context.user_data)
        self.assertEqual('Марина',context.user_data['name'])
        self.assertIn('4 000',message.reply_text.call_args.args[0])

    async def test_failure_keeps_retry_state(self):
        data=dict(step='result',updated=time.monotonic(),name='Анна',sphere='Другое',situation='Запрос',birth='1990-01-01',tried='-',goal='Ясность')
        context=SimpleNamespace(user_data={'diagnosis':data})
        message=SimpleNamespace(reply_text=AsyncMock())
        with patch.object(bot,'ai',AsyncMock(side_effect=ValueError('bad'))):
            await bot.finish_diagnosis(message,context)
        self.assertEqual('result',context.user_data['diagnosis']['step'])

    def test_expired_session_is_removed(self):
        data={'diagnosis':{'step':'name','updated':time.monotonic()-1801}}
        self.assertIsNone(diagnosis.active(data))
        self.assertNotIn('diagnosis',data)


if __name__ == '__main__':
    unittest.main()
