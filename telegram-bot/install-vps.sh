#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR=/opt/taroway/telegram-bot
VENV_DIR=/opt/taroway/telegram-venv

for document in privacy offer consent; do
  [[ -s "${SOURCE_DIR}/../dist/${document}/index.html" ]] || { echo "Build website legal documents before installing bot"; exit 1; }
done

install -d -o taroway -g taroway -m 0750 "${INSTALL_DIR}"
install -o taroway -g taroway -m 0640 "${SOURCE_DIR}/bot.py" "${INSTALL_DIR}/bot.py"
install -o taroway -g taroway -m 0640 "${SOURCE_DIR}/diagnosis.py" "${INSTALL_DIR}/diagnosis.py"
install -o taroway -g taroway -m 0640 "${SOURCE_DIR}/legal.py" "${INSTALL_DIR}/legal.py"
install -d -o taroway -g taroway -m 0750 "${INSTALL_DIR}/legal-documents"
for document in privacy offer consent; do
  install -o taroway -g taroway -m 0640 "${SOURCE_DIR}/../dist/${document}/index.html" "${INSTALL_DIR}/legal-documents/${document}.html"
done
install -o taroway -g taroway -m 0640 "${SOURCE_DIR}/requirements.txt" "${INSTALL_DIR}/requirements.txt"
install -o root -g root -m 0700 "${SOURCE_DIR}/configure.py" "${INSTALL_DIR}/configure.py"

if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
  python3 -m venv "${VENV_DIR}"
fi
"${VENV_DIR}/bin/pip" install --disable-pip-version-check -r "${INSTALL_DIR}/requirements.txt"
chown -R taroway:taroway "${VENV_DIR}"

if [[ ! -e /etc/taroway/bot-consent.key ]]; then
  (umask 077; "${VENV_DIR}/bin/python" -c 'from cryptography.fernet import Fernet; import os; fd=os.open("/etc/taroway/bot-consent.key",os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600); os.write(fd,Fernet.generate_key()); os.close(fd)')
fi

install -o root -g root -m 0644 "${SOURCE_DIR}/taroway-bot.service" /etc/systemd/system/taroway-bot.service
systemctl daemon-reload

if [[ ! -s /etc/taroway/telegram.env ]]; then
  echo "Code installed. Next run: python3 ${INSTALL_DIR}/configure.py"
  exit 0
fi

systemctl enable --now taroway-bot.service
systemctl restart taroway-bot.service
systemctl --no-pager --full status taroway-bot.service
