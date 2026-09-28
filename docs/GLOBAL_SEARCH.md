# 4inOne — Global Search

## Purpose

The top-level search should eventually let a user find relevant accessible information across domains without navigating each section separately.

This is a product feature, not decorative UI.

## Example searches

### “Waschmaschine”

Possible accessible results:

- household task;
- savings goal;
- delivery calendar event;
- connected-items context.

### “Berlin”

Possible accessible results:

- trip;
- tasks;
- calendar events;
- related expenses/budget records where supported.

## Requirements

- permission-aware;
- grouped or clearly labelled by domain/type;
- fast enough for normal use;
- keyboard-friendly on desktop;
- sensible empty/loading/error states;
- no metadata leaks.

## Result presentation

Show enough context to distinguish results, but not excessive detail.

Possible fields:

- icon/domain;
- title;
- short secondary context;
- date/status where relevant.

## Permissions

Search must reuse backend authorization logic. Do not fetch all records client-side and filter them in Angular.

## Command palette later

A later `Cmd/Ctrl + K` experience may combine:

- search;
- navigation;
- quick creation.

Do not build a command platform before basic global search is useful and stable.
