#!/usr/bin/env python3
"""Run interactively by the owner; never pass merchant passwords as arguments."""
import getpass
import os
from pathlib import Path

if os.geteuid() != 0:
    raise SystemExit('Run as root')
os.umask(0o077)
p1 = getpass.getpass('Robokassa LIVE password #1: ')
p2 = getpass.getpass('Robokassa LIVE password #2: ')
if not p1 or not p2 or p1 == p2 or any(c in p1+p2 for c in '\r\n\x00'):
    raise SystemExit('Invalid passwords; nothing saved')
active = input('Merchant activated and NPD receipts configured? Type YES to enable live payments: ') == 'YES'
def quote(value):
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'
target = Path('/etc/taroway/payments.env')
target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
temporary = target.with_suffix('.env.new')
with temporary.open('x') as output:
    output.write('ROBOKASSA_LOGIN=taroway\nROBOKASSA_HASH=md5\nGIGACHAT_ENABLED=1\n')
    output.write('ROBOKASSA_PASSWORD_1=' + quote(p1) + '\nROBOKASSA_PASSWORD_2=' + quote(p2) + '\n')
    output.write('ROBOKASSA_RECEIPTS_READY=' + ('1' if active else '0') + '\n')
    output.write('PAYMENT_MODE=' + ('robokassa' if active else 'requests') + '\n')
temporary.replace(target)
print('Saved privately. Restart taroway-api to apply. Mode: ' + ('live' if active else 'requests'))
