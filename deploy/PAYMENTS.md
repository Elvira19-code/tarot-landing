# Payment and generation activation

Result URL: https://taroway.com/api/robokassa/result (POST)
Success URL: https://taroway.com/order-result/ (GET)
Fail URL: https://taroway.com/order-result/ (GET)
MerchantLogin: taroway. Hash: MD5, as confirmed by the owner.
Only passwords 1 and 2 are used by this payment flow; password 3 is not needed.
Use distinct LIVE passwords, not the test credentials. Never commit them.

The callback checks password-2 signature, signed receipt contacts and amount
against the pre-existing order before recording payment in SQLite. Repeated
callbacks return OK followed by the invoice ID without queueing work twice.
Browser success redirects never mark an order paid.

After the merchant and NPD receipt setup have been confirmed, the owner runs:

    python3 /opt/taroway/site/deploy/configure-payments.py

It prompts without echo and writes /etc/taroway/payments.env with private
permissions. Restart taroway-api afterwards. Keep requests mode until ready.
The service uses systemd LoadCredential for the Cloud.ru key, without making
/etc/taroway public. No email, name or phone is included in the model payload.

GigaChat uses Cloud.ru's OpenAI-compatible API for paid tarot orders only.
Consultation payments confirm the booking without AI generation. Astrology
services remain requests until a real calculation engine is integrated.
SMS receipt delivery is not integrated yet; online payment requires email.
The customer result page polls the durable state and renders plain text.
Generation failures keep payment recorded and show a contact instruction.

Before enabling public payments, complete an isolated test callback plus an
owner-performed real payment and verify the NPD receipt in the merchant panel.
Unit tests use fake credentials and never call the real payment provider.

Sources:
- https://docs.robokassa.ru/ru/notifications-and-redirects
- https://docs.robokassa.ru/ru/pay-interface
- https://docs.robokassa.ru/ru/fiscalization
- https://cloud.ru/docs/foundation-models/ug/topics/quickstart
