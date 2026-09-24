# Publication readiness

Public UI accepts requests only. It does not simulate payments or promise a
generated report before availability has been confirmed. PAYMENT_MODE=requests
is the default; NODE_ENV=production rejects demo/payment test modes.

## Hosting blocker

On 2026-09-24, https://taroway.com returned HTTP 200, but /api/catalog and
/api/availability both returned HTTP 404. Existing FTP deployment uploads only
dist/. It cannot run server/app.mjs. Publishing these forms without the API
would leave booking and order submission unavailable.

Run the Node 24 server on the agreed Timeweb Cloud VPS with a persistent private
DATA_DIR and a same-origin reverse proxy for /api/. Set APP_ORIGIN and SITE_URL
to https://taroway.com, PAYMENT_MODE=requests, NODE_ENV=production. Keep the
server listening on 127.0.0.1 behind HTTPS. Validate backups, ownership, firewall
and operator access before accepting real personal data. Never upload the
development private/ directory, .env, admin.token or QA SQLite databases.

No VPS changes have been made by this preparation. DNS/reverse-proxy changes
require verified access and target configuration, not guessed credentials.

## GitHub Actions

The verify job builds and runs server tests on main and codex branches.
Production deployment runs only on main. Before FTP upload it verifies the
request API and calendar. A missing API blocks the upload. After upload it
checks release.json against GITHUB_SHA and rechecks the API.

Tests use isolated temporary data. Real user data is not deleted. Historical
test scaffolding remains in server test files, not in public pages or the
default production mode. The existing demo worker is inaccessible in requests
mode and production rejects enabling it.

The earlier BOOKING-RELEASE.md and ORDER-SYSTEM.md describe the development
payment experiments; this document defines the publication gate.
