# Order prototype

Local site + API: Node 24, `node --env-file-if-exists=.env server/app.mjs`, default http://127.0.0.1:4322/order/.
Run `npm run build` first. Tests: `node --test server/test.mjs`.

This is a functional local order/payment-state prototype, NOT a production payment system.
Modes: demo (no outgoing payment requests), robokassa-test (test keys only).
Real payment mode is deliberately rejected. Test outputs are labelled demonstrations.
The server runs separately from Astro. FTP upload of dist does not deploy the API.

Robokassa test configuration: SHA256 signatures, POST ResultURL `/api/robokassa/result`,
GET SuccessURL and FailURL `/order-result/` on the same public staging origin.
Do not expose the local demo server publicly. Remote callbacks require a properly secured staging server.
Returning to SuccessURL never marks an order paid. Only a verified ResultURL does.
Duplicate ResultURL notifications are acknowledged without requeueing ready orders.
An interrupted processing job re-enters the queue after restart.

Orders are in private/orders.sqlite, excluded from Git. Protect directory, backups and disks.
Access tokens are random bearer tokens, hashed in DB and kept in sessionStorage in the current tab.
No personal details in order URLs. Before production: recovery, token expiry, encrypted storage,
retention/deletion, operator authentication, audit logging, secure backups, TLS reverse proxy,
bounded retries and worker leases, rate limiting at proxy, real checkout receipt configuration,
refund workflow and merchant approval must be implemented and tested.

Still required: Kerykeion version/licensing, offline place/timezone catalog (historical time zones),
unknown birth time handling; GigaChat provider credentials, approved scope and data-processing terms;
generation quality checks and failure recovery. Neither provider is called by this prototype.
The current 30-day month is explicitly shown before ordering; confirm calendar-month semantics before launch.
Tarot uses all 78 fixed ordered positions without randomness. Card names are shown only in a test result.
Original licensed face illustrations and actual interpretations remain to be supplied.

BOT_TOKEN reserved only; paid orders are NOT sent to Telegram. Bot development is a separate phase.
Robocheki SMZ not integrated/verified. No real receipts are generated in demo mode.
Do not change legal drafts to claim live payment or generation until these steps are complete.

References:
- https://docs.robokassa.ru/ru/pay-interface
- https://docs.robokassa.ru/ru/notifications-and-redirects
- https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/gigachat-api
- https://kerykeion.net/python-library/docs/v5/astrological_subject_factory
