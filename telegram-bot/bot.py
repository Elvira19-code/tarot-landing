"""Taroway Telegram assistant. Secrets are supplied only through the environment."""
import logging
import os
import secrets
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from telegram import InlineKeyboardButton as Button, InlineKeyboardMarkup as Markup, Update
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, filters

PROMPT = ('Ты — вежливый консультант по Таро и астрологии. Отвечай кратко (3–5 предложений), '
          'на русском. Помогай с вопросами: что такое расклад Таро, как проходит консультация, '
          'какие услуги есть, как записаться. Отвечай только по теме. Если не знаешь — предложи '
          'записаться. Не выдумывай цены и не обещай результатов. Не давай медицинских, '
          'юридических или финансовых советов.')
SIGNS = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион',
         'Стрелец', 'Козерог', 'Водолей', 'Рыбы']
MAJORS = ['Шут', 'Маг', 'Верховная Жрица', 'Императрица', 'Император', 'Иерофант',
          'Влюблённые', 'Колесница', 'Сила', 'Отшельник', 'Колесо Фортуны',
          'Справедливость', 'Повешенный', 'Смерть', 'Умеренность', 'Дьявол',
          'Башня', 'Звезда', 'Луна', 'Солнце', 'Суд', 'Мир']
THEMES = ['новое начало', 'инициатива', 'внимание к себе', 'забота', 'границы', 'ценности',
          'осознанный выбор', 'направление', 'терпение', 'пауза для размышлений', 'перемены',
          'честность', 'другая точка зрения', 'завершение этапа', 'баланс', 'привычки',
          'пересмотр опор', 'надежда', 'неопределённость', 'радость', 'переоценка', 'целостность']
MAJOR_FILES = ['Fool', 'Magician', 'High Priestess', 'Empress', 'Emperor', 'Hierophant',
               'Lovers', 'Chariot', 'Strength', 'Hermit', 'Wheel of Fortune', 'Justice',
               'Hanged Man', 'Death', 'Temperance', 'Devil', 'Tower', 'Star', 'Moon',
               'Sun', 'Judgement', 'World']
DECK = [(name, theme, f'RWS Tarot {number:02d} {filename}.jpg')
        for number, (name, theme, filename) in enumerate(zip(MAJORS, THEMES, MAJOR_FILES))] + [
    (f'{rank} {suit}', theme, f'{code}{number:02d}.jpg')
    for suit, code, theme in [('Жезлов', 'Wands', 'инициатива и энергия'),
                              ('Кубков', 'Cups', 'чувства и общение'),
                              ('Мечей', 'Swords', 'ясность мысли'),
                              ('Пентаклей', 'Pents', 'повседневные дела')]
    for number, rank in enumerate(['Туз', 'Двойка', 'Тройка', 'Четвёрка', 'Пятёрка',
                                   'Шестёрка', 'Семёрка', 'Восьмёрка', 'Девятка',
                                   'Десятка', 'Паж', 'Рыцарь', 'Королева', 'Король'], 1)]
PAID_SERVICES = [
    ('🗓 Гороскоп на день', 'https://taroway.com/order?service=horoscope-day'),
    ('📅 Гороскоп на неделю', 'https://taroway.com/order?service=horoscope-week'),
    ('🗓 Гороскоп на месяц', 'https://taroway.com/order?service=horoscope-month'),
    ('🌟 Натальная карта', 'https://taroway.com/order?service=natal-chart'),
    ('🃏 Таро «Выбор пути»', 'https://taroway.com/order?service=tarot-path'),
    ('🚂 Таро «Вокзал на двоих»', 'https://taroway.com/order?service=tarot-station'),
    ('✝️ Таро «Кельтский крест»', 'https://taroway.com/order?service=tarot-celtic'),
]


def keyboard(*items):
    return Markup([[Button(label, callback_data=data)] for label, data in items])


def menu(page=0):
    if page == 0:
        return keyboard(('💰 Платные услуги', 'paid:0'), ('🔮 Гороскоп', 'signs:0'),
                        ('Ещё', 'menu:1'))
    if page == 1:
        return keyboard(('🃏 Карта дня', 'card'), ('📝 Записаться', 'book'), ('Ещё', 'menu:2'))
    return keyboard(('ℹ️ О нас', 'about'), ('Назад', 'menu'))


def paid_menu(page):
    start = page * 2
    buttons = [Button(label, url=url) for label, url in PAID_SERVICES[start:start + 2]]
    if start + 2 < len(PAID_SERVICES):
        buttons.append(Button('Следующие услуги →', callback_data=f'paid:{page + 1}'))
    else:
        buttons.append(Button('Назад', callback_data='menu'))
    return Markup([[button] for button in buttons])


BACK = keyboard(('Назад', 'menu'))


async def start(update, context):
    context.user_data.pop('booking', None)
    await update.message.reply_text('Здравствуйте! Я помощник Эльвиры, Taroway. Выберите раздел '
                                    'или задайте вопрос о консультации. /cancel — отменить запись.',
                                    reply_markup=menu())


async def ai(text):
    credential = Path(os.environ.get('CREDENTIALS_DIRECTORY', '/etc/taroway')) / 'cloudru.key'
    key = os.environ.get('CLOUD_RU_API_KEY') or credential.read_text().strip()
    async with httpx.AsyncClient(timeout=45, follow_redirects=False) as client:
        response = await client.post('https://foundation-models.api.cloud.ru/v1/chat/completions',
            headers={'Authorization': 'Bearer ' + key}, json={
                'model': 'ai-sage/GigaChat3.5-432B-A28B', 'max_tokens': 500,
                'messages': [{'role': 'system', 'content': PROMPT}, {'role': 'user', 'content': text}]})
        response.raise_for_status()
        choice = response.json()['choices'][0]
        answer = choice['message']['content']
        if choice.get('finish_reason') != 'stop' or not isinstance(answer, str) or not answer.strip():
            raise ValueError('Incomplete response')
        return answer[:3500]


async def answer_ai(message, context, prompt):
    now = time.monotonic()
    if now - context.user_data.get('last_ai', -100) < 15:
        await message.reply_text('Пожалуйста, подождите несколько секунд перед следующим вопросом.')
        return
    context.user_data['last_ai'] = now
    try:
        result = await ai(prompt)
    except (OSError, httpx.HTTPError, ValueError, KeyError, IndexError):
        result = 'Сейчас не получается подготовить ответ. Вы можете записаться к Эльвире через меню.'
    await message.reply_text(result, reply_markup=BACK)


async def card_image(filename, cache):
    if filename in cache:
        return cache[filename]
    async with httpx.AsyncClient(timeout=30, follow_redirects=True,
                                 headers={'User-Agent': 'TarowayBot/1.0 (https://taroway.com)'}) as client:
        metadata = await client.get('https://commons.wikimedia.org/w/api.php', params={
            'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'iiprop': 'url',
            'iiurlwidth': 600, 'titles': 'File:' + filename,
        })
        metadata.raise_for_status()
        page = next(iter(metadata.json()['query']['pages'].values()))
        image_url = page['imageinfo'][0].get('thumburl') or page['imageinfo'][0]['url']
        response = await client.get(image_url)
        response.raise_for_status()
        if not response.headers.get('content-type', '').startswith('image/') or len(response.content) > 9_000_000:
            raise ValueError('Invalid image response')
    cache[filename] = response.content
    return response.content


async def send_booking(message, context):
    data = context.user_data.get('booking')
    if not data or data.get('step') != 'send':
        return
    try:
        await context.bot.send_message(chat_id=context.bot_data['owner'], text=(
            f"Новая заявка Taroway\nИмя: {data['name']}\nКонтакт: {data['contact']}\n"
            f"Запрос: {data['question']}"))
    except Exception:
        await message.reply_text('Не удалось отправить заявку. Данные пока сохранены в этом диалоге.',
                                 reply_markup=keyboard(('Повторить отправку', 'retry'), ('Отменить', 'menu')))
        return
    context.user_data.pop('booking', None)
    await message.reply_text('Спасибо! Свяжусь с вами.', reply_markup=BACK)


async def callback(update, context):
    query = update.callback_query
    await query.answer()
    action = query.data
    message = query.message
    # Remove old keyboards to avoid sending the same booking twice by repeated clicks.
    await query.edit_message_reply_markup(reply_markup=None)
    if action == 'menu' or action.startswith('menu:'):
        context.user_data.pop('booking', None)
        page = int(action.split(':')[1]) if ':' in action else 0
        await message.reply_text('Выберите раздел:', reply_markup=menu(page))
    elif action.startswith('paid:'):
        page = int(action.split(':')[1])
        await message.reply_text('Выберите услугу:', reply_markup=paid_menu(page))
    elif action == 'about':
        await message.reply_text('Эльвира — консультант по Таро и астрологии. '
            'Консультации помогают спокойно обсудить ваш запрос, без обещаний результата.\n'
            'Сайт: https://taroway.com\nСвязаться и записаться: https://taroway.com/contact/', reply_markup=BACK)
    elif action.startswith('signs:'):
        page = int(action.split(':')[1]) % 6
        await message.reply_text('Выберите знак зодиака. /start — главное меню.', reply_markup=keyboard(
            (SIGNS[page * 2], f'sign:{page * 2}'), (SIGNS[page * 2 + 1], f'sign:{page * 2 + 1}'),
            ('Следующие знаки →', f'signs:{(page + 1) % 6}')))
    elif action.startswith('sign:'):
        sign = SIGNS[int(action.split(':')[1])]
        today = datetime.now(ZoneInfo('Europe/Moscow')).date()
        await answer_ai(message, context, f'Гороскоп на {today} для знака {sign}: '
            'дай общий символический настрой дня в 3 предложениях. Не выдумывай положения планет '
            'и события. Укажи, что это не персональный астрологический расчёт и не прогноз фактов.')
    elif action == 'card':
        name, theme, filename = secrets.choice(DECK)
        reversed_card = bool(secrets.randbelow(2))
        position = 'перевёрнутое' if reversed_card else 'прямое'
        meaning = (f'Тема карты — {theme}. Обратите внимание, где сегодня можно действовать '
                   'спокойно и осознанно.' if not reversed_card else
                   f'Тема карты — {theme}. Перевёрнутое положение предлагает заметить задержку, '
                   'внутреннее сопротивление или необходимость пересмотреть привычный подход.')
        caption = (f'Карта дня: {name}\nПоложение: {position}\n\n{meaning}\n\n'
                   'Это символическая подсказка для размышления, а не предсказание.\n'
                   'Изображение: Pamela Colman Smith, Wikimedia Commons, общественное достояние.')
        try:
            image = await card_image(filename, context.bot_data.setdefault('card_images', {}))
            await message.reply_photo(image, caption=caption, reply_markup=BACK)
        except (OSError, httpx.HTTPError, ValueError, KeyError, StopIteration):
            await message.reply_text(caption + '\nИзображение временно недоступно.', reply_markup=BACK)
    elif action == 'book':
        context.user_data.pop('booking', None)
        await message.reply_text('Для записи подтвердите, что вам исполнилось 18 лет и вы согласны '
            'на передачу имени, контакта и запроса Эльвире через Telegram для обратной связи. '
            'Политика: https://taroway.com/privacy/\nНе указывайте чувствительные сведения.',
            reply_markup=keyboard(('Мне 18+, согласен(на)', 'consent'), ('Назад', 'menu')))
    elif action == 'consent':
        context.user_data['booking'] = {'step': 'name'}
        await message.reply_text('Как вас зовут?')
    elif action == 'retry':
        await send_booking(message, context)


async def text(update, context):
    message = update.message
    value = message.text.strip()
    data = context.user_data.get('booking')
    if data:
        step = data['step']
        if step == 'send':
            await message.reply_text('Нажмите «Повторить отправку» или /cancel.')
            return
        limit = {'name': 80, 'contact': 160, 'question': 1000}[step]
        if not value or len(value) > limit:
            await message.reply_text(f'Введите от 1 до {limit} символов.')
            return
        data[step] = value
        if step == 'name':
            data['step'] = 'contact'
            await message.reply_text('Ваш телефон или Telegram?')
        elif step == 'contact':
            data['step'] = 'question'
            await message.reply_text('Опишите запрос (или напишите "-")')
        else:
            data['step'] = 'send'
            await send_booking(message, context)
    elif len(value) > 1000:
        await message.reply_text('Сократите вопрос до 1000 символов.')
    else:
        await answer_ai(message, context, value)


async def on_error(update, context):
    # Telegram URLs contain the token; never log exception bodies or updates.
    logging.error('Bot operation failed: %s', type(context.error).__name__)


def configuration():
    token = os.environ['TELEGRAM_BOT_TOKEN'].strip()
    owner = int(os.environ['TELEGRAM_OWNER_ID'])
    if not token or owner <= 0:
        raise ValueError('Set TELEGRAM_BOT_TOKEN and positive TELEGRAM_OWNER_ID')
    return token, owner


def build_app():
    token, owner = configuration()
    app = Application.builder().token(token).concurrent_updates(False).build()
    app.bot_data['owner'] = owner
    private = filters.ChatType.PRIVATE
    app.add_handler(CommandHandler(['start', 'cancel'], start, filters=private))
    app.add_handler(CallbackQueryHandler(callback))
    app.add_handler(MessageHandler(private & filters.TEXT & ~filters.COMMAND, text))
    app.add_error_handler(on_error)
    return app


if __name__ == '__main__':
    logging.basicConfig(level=logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    build_app().run_polling(allowed_updates=['message', 'callback_query'])
