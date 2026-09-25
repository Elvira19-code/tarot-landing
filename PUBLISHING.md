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

## VPS preparation (2026-09-24)

The owner approved preparing a move of both site and API to the existing VPS
147.45.157.115. Public DNS still resolves to 92.53.96.169; it must not change
until HTTPS, API tests, backups and rollback are ready.

Node 24.21.0 was installed under /opt/node-v24.21.0-linux-x64 from the official
archive after SHA-256 verification. Release 126a7f8 was extracted under
/opt/taroway/site-126a7f8, separately from the existing Python venv and key.
The service template deploy/taroway-api.service expects /opt/taroway/site to
point to the reviewed release. It binds the application's loopback listener on
4325 and keeps SQLite and the generated administrator token in a private
/var/lib/taroway-site directory. Do not print or commit that token.

The service template alone does not provide HTTPS, reverse proxy, backups or
a production deployment pipeline. Verify those before changing DNS. The
current GitHub workflow still deploys static files by FTP only on main.

On 2026-09-25 taroway-api.service was installed and enabled on the VPS. The
loopback /api/availability endpoint returned a valid Europe/Moscow calendar.
Certbot from Ubuntu was installed; DNS-01 issuance is being prepared before
the DNS switch. deploy/taroway.nginx.conf is a pending configuration, not yet
installed. It requires the issued certificate. After the DNS switch, replace
manual renewal with a tested webroot renewal using /var/www/letsencrypt;
manual DNS issuance by itself does not provide unattended renewal.

TRUST_LOCAL_PROXY=1 is only suitable behind the supplied local Nginx proxy,
which overwrites X-Real-IP. Other peers and malformed addresses are ignored.

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
