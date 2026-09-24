# 4inOne — Product Requirements

## 1. Global requirements

Users must be able to:

- register;
- sign in;
- sign out;
- use the product privately;
- create or join shared contexts where supported;
- understand what is private and what is shared;
- navigate between Finanzen, Haushalt, Organisation and Reisen;
- see a personalized "Heute" view;
- receive transparent suggestions;
- create connections between related objects.

## 2. Dashboard

The dashboard answers:

> **Was ist heute wichtig?**

### Required dashboard sections

- Greeting
- Today / relevant items
- 4inOne suggestion
- Connected item summary
- Compact entry points to the four domains

### Dashboard rules

- Do not show every statistic available.
- Prefer a maximum of a few high-value items per section.
- Use progressive disclosure.
- The user should be able to reach detail views.
- Mobile dashboard should be shorter than desktop.

## 3. Finanzen

Finanzen must be useful as a private product area.

### Core capabilities

- income
- expenses
- categories
- monthly budgets
- savings goals
- recurring costs
- basic financial overview
- optional shared budgets / costs later

### Connections

Possible connections:

- savings goal ↔ trip
- expense ↔ household purchase
- budget ↔ event/project
- recurring cost ↔ reminder

Finanzen must not require a trip or household.

## 4. Haushalt

Haushalt supports an individual or shared home.

### Core capabilities

- tasks
- recurring tasks
- due dates
- shopping lists
- responsibility / assignee
- routines
- completion state

### Connections

Possible connections:

- household task ↔ calendar event
- household task ↔ absence / trip
- household purchase ↔ finance expense
- routine ↔ reminder

A person living alone must be able to use Haushalt fully.

## 5. Organisation

Organisation is the personal planning layer.

### Core capabilities

- tasks
- calendar events
- reminders
- notes
- personal projects
- shared items where permissions allow

### Connections

Possible connections:

- calendar event ↔ task
- event ↔ finance cost
- event ↔ trip
- project ↔ household work

Organisation must work as a private calendar/task system.

## 6. Reisen

Reisen is a full domain but may be implemented after the core domains.

### Core capabilities

- trip title
- destination
- start date
- end date
- participants
- trip budget
- travel tasks
- packing list
- travel events
- notes / documents later

### Connections

Possible connections:

- trip ↔ finance budget
- trip ↔ savings goal
- trip ↔ calendar events
- trip ↔ tasks
- trip ↔ household changes
- trip ↔ participants

## 7. Today

"Today" is a cross-domain view.

It can contain appointments, due tasks, household tasks, upcoming bills, relevant trip reminders and accepted automation results.

Today is a presentation layer, not a new domain.

## 8. Suggestions

A suggestion is a proposed action.

Example:

> Deine Reise beginnt in 5 Tagen. Packliste öffnen?

A suggestion must have:

- reason/context;
- proposed action;
- accept/dismiss where needed;
- no hidden destructive side effect.

## 9. Automations

Automations can be rule-based.

Initial examples:

- upcoming trip + missing packing list → suggest creating/opening packing list;
- recurring household task falls during absence → suggest reschedule/reassign;
- savings goal is behind schedule → recalculate suggested monthly contribution;
- appointment approaching → reminder.

Automations must be auditable and reversible where practical.

## 10. Sharing

Sharing must be explicit.

Possible scopes:

- personal
- household
- trip
- group/project

A user may share one scope without exposing another.

Example: a friend may join a trip without seeing the user's finances or household.

## 11. Onboarding

Registration should remain short.

After registration, onboarding can ask:

- personal vs shared use;
- whether to create a household;
- which domains the user wants to start with;
- optional preferences;
- accessibility / comfort preferences later.

Do not ask for unnecessary data during sign-up.
