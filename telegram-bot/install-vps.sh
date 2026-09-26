#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR=/opt/taroway/telegram-bot
VENV_DIR=/opt/taroway/telegram-venv

install -d -o taroway -g taroway -m 0750 "${INSTALL_DIR}"
install -o taroway -g taroway -m 0640 "${SOURCE_DIR}/bot.py" "${INSTALL_DIR}/bot.py"
install -o taroway -g taroway -m 0640 "${SOURCE_DIR}/requirements.txt" "${INSTALL_DIR}/requirements.txt"
install -o root -g root -m 0700 "${SOURCE_DIR}/configure.py" "${INSTALL_DIR}/configure.py"

if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
  python3 -m venv "${VENV_DIR}"
fi
"${VENV_DIR}/bin/pip" install --disable-pip-version-check -r "${INSTALL_DIR}/requirements.txt"
chown -R taroway:taroway "${VENV_DIR}"

install -o root -g root -m 0644 "${SOURCE_DIR}/taroway-bot.service" /etc/systemd/system/taroway-bot.service
systemctl daemon-reload

if [[ ! -s /etc/taroway/telegram.env ]]; then
  echo "Code installed. Next run: python3 ${INSTALL_DIR}/configure.py"
  exit 0
fi

systemctl enable --now taroway-bot.service
systemctl restart taroway-bot.service
systemctl --no-pager --full status taroway-bot.service
