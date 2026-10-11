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

Registration sends a confirmation link `${FRONTEND_URL}/email-bestaetigen?token=…` (`core/email_verification.py`,
signed with `django.core.signing`, 3 days, bound to account + current address; no extra table). `POST
/auth/email/verify/` needs no login (the link is the mailbox proof), `POST /auth/email/resend/` needs login (3/hour).
`/auth/me/` and login/refresh return `email_verified`. Only confirmed addresses get contact requests in the app:
`/notifications/` then includes them as `CONTACT_INVITE` (inviter name and relation, no email), answered via the
existing `/contacts/invites/<token>/accept|decline/`. Unconfirmed accounts see a quiet hint with „Mail senden“
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
`${FRONTEND_URL}/passwort-zuruecksetzen?token=…` (console mailer locally, SMTP once `EMAIL_HOST` is set). The page
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
