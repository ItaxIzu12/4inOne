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
