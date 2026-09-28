# 4inOne — Product Requirements V2

## 1. App shell and dashboard

The logged-in experience contains the four areas plus cross-domain entry points such as Today, search, profile/settings and later Connections.

The start screen should not be a wall of statistics.

### Today

“Today” answers one question:

> **Was ist heute wichtig?**

It may show a small number of relevant items such as:

- an appointment;
- a due task;
- a household responsibility;
- an upcoming bill/reminder;
- a trip-related reminder;
- later, one relevant suggestion.

Today is a cross-domain presentation layer, not a fifth domain.

## 2. Finanzen

Must be useful privately and independently.

Core capabilities:

- income and expenses;
- categories;
- monthly budgets;
- recurring costs where implemented;
- savings goals;
- overview of recent activity;
- explicit currency handling;
- money stored with Decimal semantics, never floating point.

Finances should not be shared by default even when the user is part of a household or group.

## 3. Haushalt

Must work for one person as well as shared households.

Core capabilities:

- household/personal chores;
- due dates;
- recurring routines;
- status;
- optional assignee in shared contexts;
- shopping list;
- rooms/devices only where they provide real value.

Do not force family terminology.

## 4. Organisation

Core capabilities:

- tasks;
- calendar events;
- reminders where supported;
- notes or small personal projects where useful;
- Today aggregation.

Organisation should remain fully usable as a private calendar/task system.

## 5. Reisen

Core capabilities:

- trips;
- destination;
- start/end dates;
- participants where explicitly shared;
- packing list;
- trip tasks;
- trip budget or budget reference;
- travel events;
- notes/documents later.

Reisen is one of four equal areas. It must not become the product's only cross-domain example.

## 6. Demo experience

A public or pre-account demo may use example data to make the concept understandable.

Requirements:

- visibly labelled as demo/example data;
- isolated from real accounts;
- safe to modify/reset;
- no implication that fake financial records belong to a real user;
- clear CTA to create/use a real account.

Real accounts should not receive demo transactions/tasks/trips automatically.

## 7. Onboarding

Registration stays short.

Onboarding should be brief and skippable where practical.

Recommended questions:

- use only for myself vs together with others;
- which areas the user wants to start with;
- optional name/avatar/profile basics;
- whether to explore a demo or start with own data.

Area selection personalizes the experience; it should not permanently disable other areas.

## 8. Empty states

Real accounts with no data should show useful guidance instead of fake content.

Examples:

- “Noch kein Budget angelegt. Starte mit deinem Monatsbudget.”
- “Heute ist noch nichts geplant.”
- “Erstelle deine erste Haushaltsaufgabe.”
- “Noch keine Reise geplant. Wohin soll es als Nächstes gehen?”

## 9. Global search

Search should eventually cover accessible objects across domains.

Examples:

- “Waschmaschine” → household task, savings goal, delivery event, connections;
- “Berlin” → trip, tasks, events, expenses where applicable.

Search must enforce permissions and must not reveal inaccessible object metadata.

## 10. Profile and settings

Profile entry is available from the app shell/top-right user control.

Expected areas:

- profile;
- account;
- people/groups;
- notifications;
- privacy;
- app preferences;
- help/support;
- logout.

## 11. Connections

Connections are explicit relationships between independently valid objects.

V1 must support:

- creating supported links;
- listing links for an object;
- viewing a small connection detail context;
- deleting links;
- strict permission checks.

V1 does not need automation.

## 12. Suggestions

A suggestion proposes an action and explains its reason.

Examples:

- trip starts soon and no packing list exists;
- recurring chore overlaps a period of absence;
- savings goal is behind schedule.

No hidden destructive side effects.

## 13. Automations

Automations come later and are user-controlled.

High-impact actions such as deleting, sharing, inviting, changing permissions or financial movement require explicit confirmation.

## 14. Responsive behavior

Web and mobile should feel like the same product.

Mobile is not a squeezed desktop. Navigation, touch targets, card density and form layouts must adapt.

## 15. Accessibility

Required:

- semantic elements;
- keyboard access;
- visible focus;
- labels for icon-only controls;
- sufficient contrast;
- readable status text in addition to color/icons;
- sensible touch targets.
