"""Safely write the Telegram bot environment file on the VPS."""
import getpass
import os
import re
import tempfile
from pathlib import Path

TARGET = Path('/etc/taroway/telegram.env')
DEFAULT_OWNER = '769698033'


def main():
    if os.geteuid() != 0:
        raise SystemExit('Run as root.')
    token = getpass.getpass('Paste Telegram bot token (hidden): ').strip()
    if not re.fullmatch(r'\d{5,}:[A-Za-z0-9_-]{20,}', token):
        raise SystemExit('Token format is invalid; nothing was saved.')
    owner = input(f'Owner Telegram ID [{DEFAULT_OWNER}]: ').strip() or DEFAULT_OWNER
    if not owner.isdecimal() or int(owner) <= 0:
        raise SystemExit('Owner ID must be a positive number; nothing was saved.')
    TARGET.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix='.telegram.', dir=TARGET.parent, text=True)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w', encoding='ascii') as stream:
            stream.write(f'TELEGRAM_BOT_TOKEN={token}\nTELEGRAM_OWNER_ID={owner}\n')
        os.replace(temp_name, TARGET)
        os.chmod(TARGET, 0o600)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    print('Telegram settings saved privately.')


if __name__ == '__main__':
    main()
