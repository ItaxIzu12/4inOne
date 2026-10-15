# 4inOne — Authentication and Permissions V2

## Registration

Keep registration intentionally short.

Typical fields:

- first name or display name;
- email;
- password;
- password confirmation;
- terms/privacy consent as legally required.

Do not request financial, household or travel details during registration.

## Authentication

Use the security mechanisms already established in the Django/Angular project, provided they are safe.

Prefer secure cookie/session or short-lived token patterns appropriate to the architecture. Do not store long-lived sensitive authentication secrets in insecure browser storage.


### Beta audit (12.10.2026)

- Access tokens carry the device session id (`sid`); `core.authentication.SessionBoundJWTAuthentication` rejects
  them as soon as the session is gone (logout, „Gerät abmelden“, „Alle anderen abmelden“, password reset) instead
  of after up to 15 minutes. Login now derives the access token after the session exists.
- Logout identifies the device by the httpOnly refresh cookie (CSRF-protected) and works without a valid access
  token. The frontend clears cached account data (finance state, invitations/notifications) whenever the signed-in
  account changes, so nothing of a previous account remains on a shared device.
- Password reset tokens are stored only as SHA-256 hashes.
- Registration: e-mail max. 254 characters (server-side); field errors in login/registration appear only after the
  first submit, then update live. A throttled login says so („Zu viele Anmeldeversuche …“) without revealing
  whether the account exists.
- No secrets in URLs or logs: mail links carry tokens only in the fragment (`/einladung#…`,
  `/passwort-zuruecksetzen#token=…`, `/email-bestaetigen#token=…`) — never sent to any server, so not in access
  logs or referrers; pages remove them from the address bar immediately (older `?token=`/path links still work).
  Contact-invite endpoints take the token in the POST body only (`/contacts/invites/lookup|accept|decline/`).
  `AXES_VERBOSE = False`: failed logins are counted for the lockout but no e-mail address is written to the log.
- Passwords are hashed with Argon2 (PBKDF2 hashes keep working and are upgraded on the next login).
- Behind a TLS-terminating reverse proxy set `BEHIND_PROXY=True` (trusted `X-Forwarded-Proto`, real client IP for
  rate limits and lockouts). Production also needs `EMAIL_HOST`; `manage.py check --deploy` is clean with both.
- Known, accepted: registration reports an already used e-mail address (usability; throttled to 3/hour per IP).
- Tests: `backend/core/test_auth_audit.py`, `frontend/e2e/auth-audit.spec.ts`.

## Ownership model

Every persistent user object must have an unambiguous access scope.

Typical scopes:

- personal;
- household/shared home;
- trip;
- group/project.

Do not assume that membership in one shared scope grants access to all other scopes.

## Private by default

Examples:

- A shared household does not automatically expose private finance records.
- A travel companion does not automatically see household tasks.
- A partner does not automatically see all private calendar events.
- A connection does not expose the target object to someone who cannot already access it.

## Connection permissions

Before creating a connection, the backend must verify that the actor can view/use both endpoints as required by the action.

Before listing a connection, verify access to the object being requested and avoid leaking inaccessible target metadata.

A connection must never become an authorization shortcut.

## Search permissions

Global search must apply the same access rules as direct object endpoints.

Do not return:

- titles;
- amounts;
- dates;
- object existence hints;
- connection metadata

for inaccessible records.

## Sharing

Sharing must be explicit and understandable.

Where possible, show the user what is being shared and with whom.

Avoid vague “share everything” defaults.

### In-app invitations (Invitation System V1)

Household and trip sharing works only through an accepted in-app invitation (`core/invitations.py`,
`core.Invitation`). Rules:

- **Request, not permission.** A `PENDING` invitation creates no membership and no visibility. `accept()` checks the
  current state again (invitee is the caller, still pending, not expired, scope exists, inviter still allowed, role
  still allowed) and then flips the status and creates the membership in one transaction.
- **Allowlist.** Scopes: `HOUSEHOLD`, `TRIP`. Roles: household `MEMBER`; trip `VIEWER`/`EDITOR`. Never `OWNER`,
  `ADMIN`, `CHILD_ACCOUNT`. Unknown scope → 400; foreign or missing scope ID → identical 404.
- **Who may invite.** Household admins; trip creator or participants with role `OWNER`. The invitee is always one
  of the inviter's own contacts — no user search, no account enumeration.
- **Server-controlled fields.** Inviter = `request.user`; invitee from the contact; status only via `accept`,
  `decline`, `revoke` (conditional `UPDATE … WHERE status='PENDING'`). Extra request fields are ignored.
- **One open request.** Partial unique constraint `(invitee, scope_type, scope_id)` where `PENDING`; inviting again
  returns the open invitation (no second notification). Already a member → 400.
- **Races.** Double accept returns the same result with one membership; accept vs. decline ends in exactly one
  final state; membership uniqueness is a DB constraint.
- **Lifecycle.** Invitee deleted → invitation deleted. Inviter deleted → kept for audit, no longer acceptable.
  Deleted scope or lost inviter rights → accept answers „nicht mehr gültig“ and marks it `REVOKED`. A removed member
  needs a new invitation; an old `ACCEPTED` one never restores access.
- **Boundaries.** Household membership opens household tasks, shopping, devices and contracts of the *active*
  household (`core/households.py`: most recently joined). Private finance, savings goals, organisation and trips are
  owner-scoped and stay private; the frozen legacy household finance only ever reads the person's *own* household
  (oldest membership). A trip invitation opens only that trip. Connections and suggestions still require both
  objects to be visible, so a shared device linked to a private savings goal never reveals the goal.
- **Notifications.** `core.Notification` only references the invitation (no copied content); `/notifications/`
  returns the caller's own items while the invitation is still open. „Read“ never changes the invitation.
- **Feedback to the inviter.** Acceptance creates one notification for the inviter (`INVITATION_ACCEPTED` /
  `CONTACT_ACCEPTED`, shown 7 days, only the invitee's display name and the scope the inviter shared). Declines are
  never notified; the inviter only sees a quiet „Nicht angenommen“ status for 14 days (`declined` in
  `/invitations/` and `/contacts/`).
- **Trips.** `POST /reisen/participants/` is gone (405); participants come only from accepted invitations.
- Tests: `backend/core/test_invitations.py` (personas Sophie, Alex, Ben, Eve).

### E-mail confirmation (in-app contact requests)

Registration sends a confirmation link `${FRONTEND_URL}/email-bestaetigen#token=…` (`core/email_verification.py`,
signed with `django.core.signing`, 3 days, bound to account + current address; no extra table). `POST
/auth/email/verify/` needs no login (the link is the mailbox proof), `POST /auth/email/resend/` needs login (3/hour).
`/auth/me/` and login/refresh return `email_verified`. Only confirmed addresses get contact requests in the app:
`/notifications/` then includes them as `CONTACT_INVITE` (inviter name and relation, no email), answered via the
existing `/contacts/invites/accept|decline/` (token in the body). Unconfirmed accounts see a quiet hint with „Mail senden“
instead. Opening the invitation link from the e-mail still works and also confirms the address. Local only
(`DEBUG` on **and** console mailer, i.e. no `EMAIL_HOST`): the resend response also contains `dev_link`, shown in
the app as „Jetzt bestätigen“ because no real e-mail is delivered; never with SMTP or without `DEBUG`.

### Mailbox proof for contact invitations

An email entered during registration is not proof of mailbox ownership. Unverified accounts receive no
pending invitation metadata or tokens from the contact list. A matching account can open and accept an invitation
using the cryptographically random link delivered to that mailbox. Acceptance consumes the invitation atomically
and records the verified address in the existing django-allauth `EmailAddress` model. Only then may the account
list other pending invitations addressed to that verified email. No existing account is automatically marked verified.
Private solo use remains available immediately after registration; this is invitation-based verification, not a
mandatory general registration-confirmation flow.
Migration `core.0010_rotate_unverified_invitation_tokens` rotates all still-open invitation secrets because old
links may already have leaked through the previous list API. Existing links then expire in practice; inviters
resend through the existing endpoint to deliver the new link. The migration sends no email itself.

Only an ADMIN of the selected household may issue household invitations, including invitations for MEMBER or
CHILD_ACCOUNT roles. The requested target role never supplies authority to the sender.

### Recovery and stored files

Flow: `/passwort-vergessen` posts the address to `auth/password-reset/request/`; the answer is identical for known
and unknown addresses, and a failing mail server is only logged. Known addresses get a 30-minute, single-use link
`${FRONTEND_URL}/passwort-zuruecksetzen#token=…` (console mailer locally, SMTP once `EMAIL_HOST` is set). The page
removes the token from the address bar immediately and posts it with the new password to
`auth/password-reset/confirm/`; a rejected token shows "Dieser Link funktioniert nicht mehr" with a link to request
a new one.

Successful password reset consumes all outstanding reset links, blacklists all refresh tokens and deletes all
device-session records. JWT password-revocation claims also reject previously issued access tokens. Refresh checks
the current password claim before rotation. Enabling this check requires one fresh login for previously issued
tokens without the claim.

Private file deletion is registered at the model level, including account cascades and queryset deletion. Physical
files are removed only after the database transaction commits; rollback preserves both file and record. Existing
orphan files from deletions performed before this change are not automatically removed.

## Demo permissions

Demo data belongs to the demo environment, not to arbitrary logged-in users.

Do not make a demo dataset globally writable in a way that lets visitors affect one another unless the data is safely reset/isolate-per-session.

## Logout

Logout must invalidate/clear the relevant authentication state and return the user to an appropriate public/login view.

## Authorization audit — permission matrix (beta security gate, 13.10.2026)

Personas: Sophie (owner), Alex (member of Sophie's household), Ben (VIEWER of trip „Berlin“), Eve (unrelated).

| Data | Sophie | Alex | Ben | Eve |
|---|---|---|---|---|
| Private finance (transactions, categories, budgets, goals, contributions, legacy household finance) | ✔ | ✘ | ✘ | ✘ |
| Shared household (tasks, shopping, devices, contracts) | ✔ | ✔ read/write | ✘ | ✘ |
| Contract/device amounts in the household folder | only own entries | only own entries | ✘ | ✘ |
| Private organisation (events, tasks, notes, files) | ✔ | ✘ | ✘ | ✘ |
| Shared trip „Berlin“ + packing/tasks/events/expenses/budget | ✔ | ✘ | ✔ read only | ✘ |
| Other trips | ✔ | ✘ | ✘ | ✘ |
| Connection shared object ↔ private goal | ✔ | ✘ (not even its existence) | ✘ | ✘ |
| Suggestions / dashboard / search | own data only | own + shared household | own + shared trip | own only |

Enforced by: every viewset filters its queryset by owner, active household or trip involvement; object
permissions for trip writes (OWNER/EDITOR) and participant management (OWNER); connections and suggestions resolve
both ends against the caller's visibility; aggregations (today, overview, trip overview) query only the caller's
scope. Foreign IDs → 404 (403 only where the object is already visible but read-only).

Fixes from this audit: amounts in the household folder (contract costs) are private to the person who entered
them (`haushalt.services.can_see_cost`; legacy entries without creator → household admin); others see the
contract without amount, cannot overwrite it, and the monthly total only adds visible amounts. Household member names never fall back to the full e-mail address (only the part before
`@`); trip expenses show each viewer the amount in their own home currency instead of revealing the creator's.

Regression: `backend/core/test_permission_matrix.py` — sweep over every list endpoint read from the URL router
(with search/filter/trip/object query params) for each persona with a positive control, direct GET/PATCH/PUT/
DELETE on every object type, creation inside foreign trips, forged owner/household/category, role escalation,
private connection targets, immediate loss of access after removal, and a fail-closed check that only the auth
allowlist is reachable without login. `test_every_detail_endpoint_is_covered_by_the_matrix` fails as soon as a new
endpoint with an object id appears that is not assigned to a permission check — e.g. when organisation sharing is
built later. The matrix also covers legacy household finance, shopping lists, organisation files (detail and
content download) and trip participants.


Re-audit (15.10.2026): one finding fixed — an existing trip row (packing item, task, event, budget category,
participant) could be re-pointed to another trip via PATCH `trip`. That let a trip owner move a participant into a
different trip without an invitation, and an editor move items (with the owner as assignee) into their own trip.
`trip` is now fixed to the stored trip on every update (`TripScopedSerializer.validate_trip`,
`TripParticipantSerializer.validate_trip`); expenses already ignored it. Verified without findings: only trip
owners and household admins can invite, invitation roles are allowlisted, forged `owner`/`created_by`/`household`
are ignored, foreign categories are rejected (also when completing shopping), trip-scoped suggestions, link
suggestions, reminders, savings and summary return 404 without content for invisible trips, and finance reports only
contain the caller's data. Tests: `test_existing_trip_rows_never_move_to_another_trip`,
`test_only_trip_owners_and_household_admins_can_invite_and_roles_are_allowlisted`,
`test_trip_scoped_suggestions_and_overviews_reveal_nothing_about_an_invisible_trip`,
`test_finance_reports_contain_only_the_requesting_persons_data`.

Remaining risks closed (15.10.2026):
- Idempotent replay (`core/idempotency.py`): a stored response with an object id is only replayed while the object is
  still in the view's `get_queryset()` for the caller; otherwise 404. Removing someone from a trip therefore also
  ends replays of their earlier create requests.
- Invitations and notifications (`core/invitations.py › _may_see_scope`): the scope name/period is only shown while
  the right behind it still exists — to the invitee of a pending invitation only while the inviter may still invite,
  to an invitee of an answered invitation only as a member, to the inviter only while still a member. Applies to
  the bell, the dashboard hint and Personen & Gruppen.
- Finance PDF: the test checks the data the PDF is built from (the PDF stream is compressed), per persona with a
  positive control.
Tests: `test_idempotent_replay_never_returns_data_after_access_was_removed`,
`test_invitations_and_notifications_hide_the_scope_once_rights_are_gone`,
`test_finance_pdf_report_is_built_only_from_the_callers_own_data`.

Sharing audit (15.10.2026) — people, invitations, memberships:
- Four separate concepts: `Contact` (social relation FAMILY/FRIEND, grants nothing) → `Invitation` (PENDING grants
  nothing) → `HouseholdMembership` / `TripParticipant` (created only by `invitations.accept`, atomically with the
  status change; unique per scope by DB constraint) → permission (checked per request from the membership).
  Only HOUSEHOLD and TRIP are shareable (scope allowlist in `core/invitations.py`); roles are allowlisted per scope
  (household: MEMBER; trip: VIEWER/EDITOR) — ADMIN/OWNER can never be requested.
- Delivery is separate from logic: `core/invitations.py` decides, `core/notifications.py` delivers (in-app). A later
  e-mail channel hooks into the same functions in `core/notifications.py` without touching invitation rules.
  Contact invites by e-mail answer identically whether an account exists (no enumeration).
- Stale UI after losing access: `frontend/src/app/core/access/access-lost.interceptor.ts` turns a 403/404 on a write
  in a shared area (reisen, haushalt, household) into a `MembershipChanges` bump; Reisen reloads its list (the open
  trip then shows „Reise nicht gefunden … kein Zugriff“), Haushalt rebuilds its tab, Personen & Gruppen reloads.
  Reisen also reloads when the browser tab becomes visible again. The frontend only mirrors server rights.
- Test: `test_relationship_and_pending_invitation_grant_no_access` (FAMILY + two pending invitations = no data;
  after accept exactly that trip / that household, never finance, organisation, other trips or private connection
  targets); e2e `aus der Reise entfernt (Aktion|Tab-Wechsel)`; unit `access-lost.interceptor.spec.ts`.
