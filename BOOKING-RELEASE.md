# Booking and receipt preview

## Local run

- Node 24, npm run build, then node server/app.mjs.
- PORT and APP_ORIGIN must agree. Bind remains 127.0.0.1.
- DATA_DIR selects the private SQLite database and admin.token.
- Without ADMIN_TOKEN the server generates a random admin key in DATA_DIR/admin.token. Never commit or publish this file.
- Admin: /admin/. Eight-hour HttpOnly SameSite=Strict session; Secure with HTTPS APP_ORIGIN. POST requests check Origin, login is rate limited.
- The new local preview uses port 4323 and private/booking-preview, isolated from older demonstration orders.

## Scheduling

Moscow UTC+3, weekdays only, 11:00/13:00/15:00/17:00, maximum three active bookings per date, 90-day booking window. BEGIN IMMEDIATE and an active-slot unique index prevent collisions. Contact requests count toward the daily cap. Unpaid order holds expire after 30 minutes. Paid holds become confirmed. Admin can confirm contact requests, cancel, or reschedule; cancellation does not perform a payment refund.

The pause switch persists in SQLite and blocks all new orders and booking submissions at the server, not only the UI. Existing orders and payment callbacks continue. Payments arriving after a reservation expires or is cancelled go to payment_review for manual resolution, never silently overbook.

## Robokassa boundary

Email is sent in the documented Email field. The selected receipt contact and channel (including phone) are also sent as signed Shp_receipt_contact and Shp_receipt_method fields and checked on ResultURL. These custom fields carry merchant data; they do NOT by themselves configure SMS fiscal-receipt delivery.

Before enabling real payments, confirm the specific Robocheki SMZ (422-FZ) integration and SMS delivery mapping with Robokassa, enable the service in the merchant account and test an actual receipt. Do not substitute an undocumented Phone parameter or generic 54-FZ receipt schema for SMZ. This release intentionally rejects live mode and retains demo / robokassa-test only. SHA256 must match the merchant test settings.

Official references:
- https://docs.robokassa.ru/ru/pay-interface
- https://docs.robokassa.ru/ru/notifications-and-redirects
- https://docs.robokassa.ru/ru/sms-notifications
- https://robokassa.com/services/

## Legal / deployment

Offer updated with three-hour notice request, without forfeiture or restriction of statutory refusal rights (https://www.consultant.ru/document/cons_doc_LAW_305/758e2cfdf136a621c8f66dcb3372b772c7b5e6e8/).
Privacy and separate consent reflect server-side bookings, receipt contact, Timeweb Moscow and the selected Cloud.ru-hosted GigaChat model. Production deployment and real generation are not part of this release. No claim that all processing stays on the VPS.
Before production: review final legal documents, legal correspondence address, processing agreements, RKN requirements, HTTPS, backups/retention, real receipt delivery and access provisioning. Removing draft labels does not certify legal compliance.

## Verification

node --test server/test.mjs server/bookings.test.mjs
node ../../work/check-booking-release.cjs

The browser test starts an isolated demo backend and private test database, checks races, daily limit, pause, admin authentication, CSRF, SMS order data, demo payment, legal pages and mobile layouts, then stops its own process. No external payment or AI request.
