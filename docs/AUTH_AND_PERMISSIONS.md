# 4inOne — Authentication & Permissions

## Authentication UX

Registration should be intentionally short.

Recommended registration fields:

- first name
- email
- password
- password confirmation
- terms/privacy confirmation

Do not ask for household, travel or financial details during registration. Use onboarding after account creation.

## Login

Login should support:

- email
- password
- password visibility toggle
- forgot password
- loading state
- generic safe error message

## Session strategy

Prefer secure server-managed authentication or secure HttpOnly cookies.

Do not place long-lived authentication secrets in localStorage.

The exact implementation must match the existing Django setup.

## Password handling

- Django must hash passwords using supported password hashers.
- Never log passwords.
- Never send passwords back to the frontend.
- Rate-limit authentication endpoints when production hardening begins.
- Add email verification if/when product requirements require it.

## Ownership

Every protected object needs clear ownership.

Examples:

- personal budget → user owns it;
- household task → household scope;
- shared trip → trip/group scope.

## Permission principle

A frontend route guard is not security.

Backend endpoints must verify access for every protected object.

## Sharing examples

### Partner

Possible access:

- Finance: view/edit only if explicitly shared
- Household: edit
- Organisation: edit
- Travel: edit

### Child / restricted member

Possible access:

- Finance: none
- Household: limited
- Organisation: limited
- Travel: view

### Friend

Can be invited to one trip without receiving household or finance access.

## Connection permissions

A connection does not override object permissions.

If a user can see a trip but cannot see a private savings goal connected to it, do not expose the goal amount or other private details.

## Future permission model

Start simple.

Possible initial roles:

- owner
- member
- viewer

Introduce domain-specific permissions only when real product use requires them.
