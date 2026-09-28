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

## Demo permissions

Demo data belongs to the demo environment, not to arbitrary logged-in users.

Do not make a demo dataset globally writable in a way that lets visitors affect one another unless the data is safely reset/isolate-per-session.

## Logout

Logout must invalidate/clear the relevant authentication state and return the user to an appropriate public/login view.
