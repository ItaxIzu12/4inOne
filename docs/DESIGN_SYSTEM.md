# 4inOne — Design System

## Direction

The interface should be:

- calm
- modern
- friendly
- light
- accessible
- slightly playful
- not childish
- not visually overloaded

Primary design rule:

> **Complex underneath. Simple on top.**

## Brand statement

**4inOne — Dein Alltag. Alles verbunden.**

## Domain colors

Colors should mainly help orientation.

- Finanzen: soft green
- Haushalt: soft pink / warm red
- Organisation: soft purple
- Reisen: soft blue

Avoid filling the entire UI with saturated colors. Most surfaces should remain neutral/white.

## Layout

### Mobile

Priority order:

1. Header / greeting
2. Heute
3. 4inOne Vorschlag
4. Automatisch verbunden
5. Domain entry points
6. Bottom navigation

Mobile should never attempt to show the full desktop dashboard.

### Desktop/Web

Suggested structure:

- left sidebar
- top search/profile bar
- greeting
- Today card
- Connected card
- suggestion card
- compact domain cards
- detail areas only when relevant

## Spacing

Use generous whitespace. Prefer fewer, clearer cards over many small widgets.

## Cards

Cards should have:

- subtle border;
- moderate radius;
- minimal shadow;
- clear heading;
- concise content;
- one obvious action when possible.

Avoid nested cards inside nested cards unless necessary.

## Typography

Use the existing project font if appropriate. Otherwise choose a highly readable modern sans-serif.

Rules:

- large clear headings;
- readable body sizes;
- avoid tiny labels;
- no decorative handwritten font for functional UI;
- decorative lettering only in optional marketing surfaces.

## Icons

Use a consistent icon system. Do not mix several icon styles. Icons support labels; they do not replace important text.

## Avatars

Use small avatars only when people are relevant. Avoid large AI-looking family illustrations in the product UI. Initials are acceptable fallbacks.

## Waves / organic shapes

Waves are a brand accent.

Use them sparingly in auth/marketing backgrounds, empty states or section accents.

Do not place decorative waves behind critical data.

## Dashboard content rules

Avoid:

- quotes of the day;
- unnecessary motivational cards;
- giant illustrations;
- too many metrics;
- showing every domain detail simultaneously.

Prefer:

- 3–4 Today items;
- 1 suggestion;
- 1 connection summary;
- 4 compact domain cards.

## States

Every component should consider:

- default
- hover (desktop)
- focus
- active
- loading
- empty
- error
- disabled

## Accessibility

- semantic HTML;
- keyboard navigation;
- visible focus;
- labels for form fields;
- sufficient contrast;
- touch targets suitable for mobile;
- do not rely on color alone;
- support larger text without breaking layouts.

## Visual references

- `references/mockup-mobile.png`
- `references/mockup-web.png`

These define direction, not pixel-perfect requirements.

Codex should preserve the spirit while implementing a real responsive UI.
