# 4inOne — Security Requirements

Security is especially important because the product may contain financial, household, calendar and travel information.

## Core rules

- Private by default.
- Enforce authorization server-side.
- Validate all input server-side.
- Treat frontend validation as UX only.
- Use HTTPS in production.
- Keep secrets out of the repository.
- Never commit production credentials.
- Use environment variables for secrets/configuration.
- Keep dependencies maintained.

## Django

- Keep `DEBUG=False` in production.
- Configure `ALLOWED_HOSTS`.
- Use CSRF protection correctly.
- Use secure cookies in production.
- Use Django's password hashing.
- Use ORM query parameters; avoid unsafe raw SQL.
- Protect object-level access.
- Avoid mass assignment patterns that allow unauthorized field changes.
- Limit error details exposed to clients.

## Angular

- Do not inject untrusted HTML.
- Avoid bypassing Angular sanitization unless absolutely justified.
- Do not store sensitive long-lived secrets in localStorage.
- Use HTTP interceptors only for appropriate transport concerns.
- Handle auth failure centrally.
- Do not hide authorization mistakes with UI-only controls.

## API

For every endpoint ask:

1. Is the user authenticated?
2. Who owns the requested object?
3. Is the user a permitted member of that scope?
4. Are they allowed to perform this action?
5. Could the response leak information about an object they cannot access?

## Financial data

For MVP:

- treat values as sensitive;
- do not log transaction payloads unnecessarily;
- use Decimal;
- require explicit sharing;
- do not expose another household member's private finance records.

## File uploads (future)

If adding receipts, travel documents or avatars:

- validate MIME/type;
- set size limits;
- use randomized storage names;
- do not trust original filenames;
- scan or isolate where appropriate;
- store documents using private access controls when sensitive.

## Automation safety

Automations should not silently:

- delete records;
- move money;
- share private data;
- invite people;
- change permissions.

High-impact actions require explicit confirmation.

## Logging

Logs should help diagnose problems without collecting unnecessary personal data.

Never log:

- passwords;
- auth tokens;
- secret keys;
- full sensitive financial payloads by default.

## Future production hardening

Before public launch:

- PostgreSQL
- production deployment configuration
- backups
- restore testing
- rate limiting
- monitoring
- audit logs for permissions/sharing
- dependency scanning
- security headers
- privacy review
- data deletion/export flows
