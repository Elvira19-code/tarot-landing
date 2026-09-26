import os
import unittest
from unittest.mock import patch

import bot


class BotConfigurationTests(unittest.TestCase):
    def test_complete_unique_deck(self):
        self.assertEqual(78, len(bot.DECK))
        self.assertEqual(78, len({name for name, _ in bot.DECK}))

    def test_every_keyboard_has_at_most_three_buttons(self):
        keyboards = [bot.menu(), bot.menu(1), bot.BACK,
                     bot.keyboard(('a', 'a'), ('b', 'b'), ('c', 'c'))]
        for markup in keyboards:
            self.assertLessEqual(sum(map(len, markup.inline_keyboard)), 3)

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
