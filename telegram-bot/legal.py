"""Published legal documents and a minimal consent audit, never conversation contents."""
import hashlib
import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from cryptography.fernet import Fernet

DOCUMENTS = Path(__file__).parent / 'legal-documents'
URLS = {name: f'https://taroway.com/{name}/' for name in ('privacy', 'offer', 'consent')}


class DocumentParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'article' and 'legal-document' in dict(attrs).get('class', '').split():
            self.inside = True
        if self.inside and tag in ('p', 'li', 'h1', 'h2', 'br'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag == 'article':
            self.inside = False
        if self.inside and tag in ('p', 'li', 'h1', 'h2'):
            self.parts.append('\n')

    def handle_data(self, data):
        if self.inside:
            self.parts.append(data)


def document(name):
    if name not in URLS:
        raise ValueError('Unknown document')
    parser = DocumentParser()
    parser.feed((DOCUMENTS / f'{name}.html').read_text(encoding='utf-8'))
    text = '\n'.join(line.strip() for line in ''.join(parser.parts).splitlines() if line.strip())
    if len(text) < 100:
        raise ValueError('Missing document text')
    return text


def version():
    return hashlib.sha256((document('privacy') + document('consent')).encode()).hexdigest()


def document_context():
    return ('\n\nНа вопросы о правилах сервиса отвечай по приведённым документам, '
            'не выдумывай условий и не давай юридических консультаций. '
            'Если ответа в документах нет, направь к elvira1966@gmail.com. '
            'Приводи ссылку на соответствующий документ.\n' + '\n\n'.join(
                URLS[name] + '\n' + document(name) for name in ('privacy', 'offer')))


def audit(user_id, action, purpose):
    if action not in ('agree', 'revoke') or purpose not in ('diagnosis', 'ai', 'booking', 'all'):
        raise ValueError('Invalid consent event')
    path = Path(os.environ.get('BOT_CONSENT_DB', '/var/lib/taroway-bot/consents.sqlite3'))
    key_path = Path(os.environ.get('CREDENTIALS_DIRECTORY', '/etc/taroway')) / 'bot-consent.key'
    cipher = Fernet(key_path.read_bytes().strip())
    created = datetime.now(timezone.utc).isoformat()
    payload = cipher.encrypt(json.dumps(dict(user_id=user_id, action=action, purpose=purpose,
                                            version=version(), created=created)).encode())
    with closing(sqlite3.connect(path)) as db, db:
        db.execute('CREATE TABLE IF NOT EXISTS consent_events (id INTEGER PRIMARY KEY, payload BLOB NOT NULL, created TEXT NOT NULL)')
        db.execute("DELETE FROM consent_events WHERE created < datetime('now','-3 years')")
        db.execute('INSERT INTO consent_events(payload,created) VALUES(?,?)', (payload, created))
    path.chmod(0o600)


PRIVACY_SHORT = ('Политика конфиденциальности бота @tarot_astro_help_bot\n\n'
    'Оператор: Кельина Эльвира Рустемовна, ИНН 262610565094, Симферополь. '
    'Контакт по данным: elvira1966@gmail.com.\n\n'
    'Бот получает Telegram ID и сообщения. Для диагностики вы указываете имя, дату рождения '
    'и ответы. Обработка через Timeweb Cloud и Cloud.ru/GigaChat начинается после отдельного согласия. '
    'Telegram также обрабатывает сообщения по своим правилам. Не присылайте чувствительные сведения.\n\n'
    'Ответы диагностики хранятся в памяти сессии, очищаются после результата или отмены. '
    'В отдельном журнале сохраняются ID, время, цель и версия согласия, но не текст ваших ответов. '
    'Команда /revoke отзывает согласие для дальнейшей работы бота и очищает текущую сессию; '
    'сообщения в Telegram она не удаляет. По вопросам доступа, исправления и удаления данных '
    'напишите оператору.\n\nПолный текст: https://taroway.com/privacy/')
