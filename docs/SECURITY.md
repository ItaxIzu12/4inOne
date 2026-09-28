# 4inOne — Security Requirements V2

4inOne may contain financial, household, calendar, travel and relationship data. Security and privacy are product requirements.

## Core rules

- Private by default.
- Authorization is enforced server-side.
- Validate input server-side.
- Frontend validation is UX, not security.
- Use HTTPS in production.
- Keep secrets out of source control.
- Use environment configuration for secrets.
- Keep dependencies maintained.

## Django

- `DEBUG=False` in production.
- correct `ALLOWED_HOSTS`/origin configuration;
- CSRF protection where applicable;
- secure cookies in production;
- Django password hashing;
- ORM over unsafe raw SQL;
- object-level access checks;
- safe serializer/form field exposure;
- avoid exposing internal exception details.

## Angular

- do not render untrusted HTML unsafely;
- do not bypass sanitization without necessity;
- do not store sensitive long-lived secrets in localStorage;
- centralize auth failure handling;
- do not treat hidden buttons/routes as authorization.

## Endpoint checklist

For every endpoint ask:

1. Is the actor authenticated where required?
2. Who owns the object?
3. What shared scope applies?
4. Is the actor permitted to read/write/delete?
5. Could the response reveal existence or metadata of inaccessible data?

## Connections

A Connection never grants permission.

Connection APIs must avoid metadata leaks from inaccessible endpoints.

## Search

Global search is a high-risk aggregation point.

Never fetch all objects and filter authorization in the browser.

Search results must already be permission-filtered on the backend.

## Financial data

- treat amounts and transaction details as sensitive;
- do not log full finance payloads by default;
- use Decimal;
- explicit sharing only;
- shared household membership does not imply shared finances.

## Demo environment

Prevent demo users from affecting each other's persistent data unless the demo architecture deliberately isolates/resets state.

Do not reuse a real user's data in a public demo.

## File uploads later

For receipts, travel documents, avatars or photos:

- validate MIME/content type;
- enforce size limits;
- randomize storage names;
- do not trust original filenames;
- use private access controls for sensitive files;
- consider scanning/isolation as deployment requirements grow.

## Automation safety

Automations must not silently perform high-impact actions such as:

- deleting records;
- sharing private data;
- inviting people;
- changing permissions;
- initiating/moving money.

Use explicit confirmation where impact is meaningful.

## Logging

Never log:

- passwords;
- auth tokens;
- secret keys;
- unnecessary full financial payloads.

## Before public launch

Plan for:

- PostgreSQL;
- backups + restore testing;
- rate limiting;
- monitoring;
- permission/sharing audit logs where justified;
- dependency/security scanning;
- security headers;
- data export/deletion flows;
- privacy review.
