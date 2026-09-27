import os
import unittest
from unittest.mock import patch

import bot


class BotConfigurationTests(unittest.TestCase):
    def test_complete_unique_deck(self):
        self.assertEqual(78, len(bot.DECK))
        self.assertEqual(78, len({name for name, _, _ in bot.DECK}))
        self.assertEqual(78, len({filename for _, _, filename in bot.DECK}))

    def test_main_menu_and_twelve_spheres(self):
        self.assertEqual(8, sum(map(len, bot.menu().inline_keyboard)))
        self.assertEqual(12, sum(button.callback_data.startswith('diag:sphere:')
            for row in bot.sphere_menu().inline_keyboard for button in row))
        self.assertTrue(all(len(row) <= 2 for row in bot.menu().inline_keyboard))

    def test_paid_service_urls(self):
        self.assertEqual(12, len(bot.PAID_SERVICES))
        self.assertEqual(12, len({url for _, url in bot.PAID_SERVICES}))
        self.assertTrue(all(url.startswith('https://taroway.com/')
                            for _, url in bot.PAID_SERVICES))

    def test_configuration_uses_environment_only(self):
        env = {
            'TELEGRAM_BOT_TOKEN': '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi',
            'TELEGRAM_OWNER_ID': '769698033',
        }
        with patch.dict(os.environ, env, clear=True):
            token, owner = bot.configuration()
        self.assertEqual(env['TELEGRAM_BOT_TOKEN'], token)
        self.assertEqual(769698033, owner)

    def test_missing_environment_is_rejected(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(KeyError):
                bot.build_app()


if __name__ == '__main__':
    unittest.main()
