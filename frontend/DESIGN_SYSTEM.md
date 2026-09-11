# Kompass — Style Reference
> aurora glow over a paper-warm canvas

**Theme:** light (dark mode extension in the "Dark Mode Tokens" section)

**Version 2 — Two-context model introduced.** A direct comparison (the extravagant Aurora Trust version vs. the minimalist variant) revealed that the full Aurora expression (glow shadows, pulse animation, filled gradient surfaces) violates a requirement already documented elsewhere — Persona B (60+) in `Gesamtkonzept.md`, Section 3, explicitly calls for "little animation." The pulse animation on the original hero card contradicted that. As of Version 2, a **two-context model** applies — this is not a change to the tokens themselves, only to how they're applied:

| Context | Expression | Why |
|---|---|---|
| **In-app** (Dashboard, Finance/Household/Organization detail views, everything behind login) | **Minimalist.** No glow shadow, no pulse animation, no filled gradient surfaces. The Aurora gradient survives only as a **text gradient** on the largest amount on each screen — one concentrated moment instead of a large surface. Card shadows (`--shadow-card-soft`) are largely replaced by 1px dividers (`--color-hairline`); sections render as flat lists rather than card grids. | Daily use with real financial data, all age groups, lower cognitive load, satisfies the app's own "little animation" requirement |
| **Marketing** (`website.html`, public landing page, auth brand panel) | **Full Aurora expression from Version 1 remains** — glow, gradient surfaces, hero card. Unchanged and still valid. | The first impression before sign-in is a different moment than daily use afterward — the "wow" effect is allowed to stay there |

All color values, contrast checks, and typography tokens below apply **unchanged to both contexts** — only the *application rules* for shadow, animation, and surface fill changed in the in-app context, not the base palette itself.

Kompass renders as a warm, light surface (cream/lavender gradient instead of pure white) with a violet-to-amber "Aurora" gradient gesture as a decorative element. The color gesture sits deliberately concentrated — in the marketing context on the hero card and background ambient glow, in the in-app context only on the amount text. Typography pairs a warm serif display face (Fraunces) for headings/amounts with a neutral, highly legible grotesque (Inter) for body copy and UI. All values are deliberately larger and higher-contrast than in the original SaaS reference system, because the target audience explicitly spans young **and** old, and the app has been subject to Germany's BFSG (WCAG 2.1 AA) since June 2025.

**What changed relative to the pure mockup "wow" effect:** Buttons are consistently filled rather than ghost-outline (recognizability over restraint), text colors are checked against minimum contrast values, the base font size is 17px rather than 14–16px, and every status color always carries an icon/symbol as a second carrier of meaning.

## Tokens — Colors

| Name | Value | Token | Role | Contrast on Canvas |
|------|-------|-------|------|------|
| Cloud Canvas | `#fdf9f2` | `--color-cloud-canvas` | Page background — warm cream instead of pure white | — |
| Lavender Mist | `#f7f5ff` | `--color-lavender-mist` | Ambient wash behind hero/feature blocks, starting point of the background glow gradient | — |
| Card White | `#ffffff` | `--color-card-white` | Card/module surfaces on canvas | — |
| Midnight Plum | `#1a1523` | `--color-midnight-plum` | Primary headings, largest amounts — near-black with a violet cast | **17:1** (AAA) |
| Slate Violet | `#4a4258` | `--color-slate-violet` | Body copy, labels, secondary headings — the workhorse tone | **9:1** (AAA) |
| Dusk Helper | `#736a82` | `--color-dusk-helper` | Metadata, timestamps, captions — **only** at 14px and up, never for important content | **4.85:1** (AA, tight) |
| Hairline | `#ece7f7` | `--color-hairline` | Card borders, dividers | — |
| Fog Surface | `#f4f1fc` | `--color-fog-surface` | Input backgrounds, subtle grouping | — |
| Violet Ink | `#5b3fd6` | `--color-violet-ink` | **Text-safe** brand color — buttons (filled), links, active icons | **6.4:1** (AA/near-AAA) |
| Violet Signal | `#7a5af8` | `--color-violet-signal` | Decorative gradient accent (hero, glow) — **not** for body text/small links | 4.3:1 (large/decorative only) |
| Amber Glow | `#ffb75e` | `--color-amber-glow` | Gradient counterpart, progress bars, "due soon" surface — surface only, never as text on light | — |
| Amber Ink | `#a15f14` | `--color-amber-ink` | Text-safe variant of amber for labels/warnings | ≥4.5:1 |
| Success Green | `#1f8a4c` | `--color-success-green` | Text/icon "done," "on budget" | ≥4.5:1 |
| Danger Coral | `#c23b52` | `--color-danger-coral` | Text/icon "over budget," errors | ≥4.5:1 |

**Core contrast rule:** Violet Signal, Amber Glow, and all gradient colors are **decoration colors** — they never carry the sole informational content and never appear as small body text on a light background. Every interactive/textual use has a darker "Ink" variant with checked contrast.

## Tokens — Typography

### Fraunces — Display serif for headings and large monetary amounts · `--font-fraunces`
- **Google Fonts:** `Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700`
- **Weights:** 500 (subheadings), 600 (standard headlines), 700 (largest hero figures only)
- **Sizes:** 22px, 24px, 28px, 32px, 40px
- **Line height:** 1.1–1.2
- **Letter spacing:** −0.01em maximum — **no** aggressive negative tracking as seen in purely trend-driven SaaS systems, which reduces legibility for low vision
- **OpenType feature:** `font-variant-numeric: tabular-nums` mandatory on all monetary amounts, so figures align cleanly in columns

### Inter — UI grotesque for body copy, buttons, navigation, labels · `--font-inter`
- **Weights:** 400 (very short secondary text only), 500 (standard body — **not** 400!), 600 (emphasis, active nav), 700 (button labels)
- **Sizes:** 13px, 14px, 15px, 17px, 19px, 22px
- **Line height:** 1.5–1.65
- **Letter spacing:** normal (0), except uppercase labels at +0.04em

**Deliberate deviation from the SaaS standard:** Body text minimum is **17px/500**, not 14px/400. Thin weights (300) do not appear anywhere in the system.

### Type Scale

| Role | Size | Weight | Line Height | Font | Token |
|------|------|--------|-------------|------|-------|
| caption | 13px | Inter 500 | 1.4 | Inter | `--text-caption` |
| body-sm | 15px | Inter 500 | 1.5 | Inter | `--text-body-sm` |
| body | 17px | Inter 500 | 1.6 | Inter | `--text-body` |
| body-lg | 19px | Inter 500 | 1.6 | Inter | `--text-body-lg` |
| subheading | 22px | Fraunces 500 | 1.3 | Fraunces | `--text-subheading` |
| heading-sm | 24px | Fraunces 600 | 1.2 | Fraunces | `--text-heading-sm` |
| heading | 32px | Fraunces 600 | 1.15 | Fraunces | `--text-heading` |
| display | 40px | Fraunces 600 | 1.1 | Fraunces | `--text-display` |
| amount-hero | 44px | Fraunces 700, tabular-nums | 1.05 | Fraunces | `--text-amount-hero` |

**Scalability (BFSG requirement):** All sizes are driven by a multiplicative CSS custom property, never hard-coded — see `--text-scale` in the Quick Start block. Users switch between 100% / 115% / 130% in app settings without layouts breaking (`rem`-based, no `px` locking in components).

## Tokens — Spacing & Shapes

**Density:** comfortable (deliberately not "compact" as in the original SaaS reference system — more whitespace, larger touch targets)

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 14 | 14px | `--spacing-14` |
| 16 | 16px | `--spacing-16` |
| 18 | 18px | `--spacing-18` |
| 20 | 20px | `--spacing-20` |
| 22 | 22px | `--spacing-22` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 60 | 60px | `--spacing-60` |
| 80 | 80px | `--spacing-80` |

### Border Radius

| Element | Value |
|---------|-------|
| mini-cards | 20px |
| task-rows | 16px |
| hero-card | 28px |
| feature-container | 40–48px |
| inputs | 14px |
| buttons | 100px (pill) |
| status-icon-container | 10–12px |

### Touch Targets (BFSG/WCAG 2.5.5)

| Element | Minimum size |
|---------|------|
| Buttons, icon buttons | 44×44px |
| Bottom nav items | 48×48px |
| Form input fields | height ≥ 48px |
| Checkboxes/radio (tap area, not just the visible icon) | 44×44px |

### Shadows & Glow

The Aurora glow remains the signature "wow" effect, but is **deployed deliberately**: only on the hero/budget card and as very soft background ambient — not on every card, or it loses its impact and hurts legibility.

| Name | Value | Token | Usage |
|------|-------|-------|---------|
| card-soft | `rgba(30,20,60,0.10) 0px 10px 24px -14px` | `--shadow-card-soft` | Standard cards (mini cards, task rows) — subtle |
| hero-glow | `rgba(122,90,248,0.45) 0px 20px 40px -12px` | `--shadow-hero-glow` | Hero/budget card exclusively |
| ambient-violet | `radial-gradient, rgba(122,90,248,0.35), transparent 70%` | `--glow-ambient-violet` | One background blob, max. 1–2 per screen |
| ambient-amber | `radial-gradient, rgba(255,183,94,0.35), transparent 70%` | `--glow-ambient-amber` | Counterpart to the violet blob, also max. 1 per screen |
| focus-ring | `0 0 0 3px rgba(91,63,214,0.35)` | `--shadow-focus` | Keyboard focus state on every interactive element — **mandatory**, not optional |

## Components

### Primary CTA Button
**Role:** Primary action — "Add expense," "Save," onboarding CTA

Filled, **not** ghost-outline (a correction relative to the original reference system). Background `--color-violet-ink` (#5b3fd6), text `#ffffff` (contrast 6.4:1), radius 100px (pill), padding 14px 28px, Inter 700 17px. An optional subtle `--shadow-hero-glow` may reinforce hover. In marketing/hero contexts the surface may additionally carry a gradient `linear-gradient(135deg, var(--color-violet-ink), var(--color-violet-signal))` — white text stays permissible only if the darker color component (Violet Ink) covers at least 60% of the surface.

### Secondary Button
**Role:** Secondary action, "Cancel," filters

Background `--color-card-white`, text `--color-violet-ink`, border 1.5px `--color-violet-ink`, radius 100px, padding 14px 28px, Inter 600 17px. Deliberately thicker border (1.5px instead of 1px) for better visibility with low vision.

### Hero Budget Card — marketing context only
**Role:** Central budget overview on marketing/auth brand pages

Gradient `linear-gradient(135deg, var(--color-violet-signal) 0%, #a78bfa 55%, var(--color-amber-glow) 130%)`, radius 28px, padding 22px, text consistently white (contrast of white text against the darkest point of the gradient checked ≥ 4.5:1). Contains a progress bar **with an additional percentage/text figure** (never just the bar color as information), amount in Fraunces 700 44px with `tabular-nums`. **No longer used in the in-app context as of Version 2** — the Balance Block applies there instead.

### Balance Block — in-app replacement for the Hero Card
**Role:** Central budget overview within the app (dashboard, finance detail view)

No card frame, no surface fill — just a section closed off with `border-bottom: 1px solid var(--color-hairline)`. Amount in Fraunces 700, size `clamp(32px, 6vw, 44px)`, color rendered as a **text gradient** (`background: linear-gradient(100deg, var(--color-violet-ink), var(--color-amber-ink)); -webkit-background-clip: text; background-clip: text; color: transparent;`) — this is the only remaining Aurora moment in the in-app context, deliberately concentrated on the single most important value on the page. Progress bar is narrow (5px instead of 8–10px), fill is a solid `--color-violet-ink`, no gradient. The label carries a small lock icon with a `title` tooltip ("Stored encrypted") as a subtle security cue.

### Section (flat list) — in-app replacement for Mini Stat Card / Task Row in dense lists
**Role:** Categories, transactions, subscription radar, fairness display — anywhere a card grid used to sit

No card background, no shadow. An `<h2>` section heading, followed by rows separated by `border-bottom: 1px solid var(--color-hairline)`, with the last row carrying no divider. This reduces visual border density when several similar records follow one another — the divider alone is sufficient structure; an additional card frame around every row would be redundant. **Mini Stat Card remains valid** for a single, isolated figure outside of a list (e.g., one standalone tile on a summary dashboard) — the Section rule applies specifically to multiple similar entries in sequence.

### Mini Stat Card
**Role:** Compact figure (shopping list, household tasks) — marketing context, or an isolated standalone figure in the in-app context, see Section above

Background `--color-card-white`, radius 20px, padding 16px, border 1px `--color-hairline`, shadow `--shadow-card-soft`. Icon container 34×34px with a subtle tint (not the signal color), title Inter 700 13px `--color-midnight-plum`, subtitle Inter 500 12px `--color-dusk-helper`.

### Task/List Row
**Role:** Individual appointment/task/list entry

Background `--color-card-white`, radius 16px, padding 13px 16px, border 1px `--color-hairline`. **Status always as a combination:** colored dot (10px, with a `box-shadow` halo for better visibility) **plus** text label — never color alone. For critical status (e.g., "overdue"), add a warning icon as well, not just red.

### Status Indicator (corrected relative to the pure SaaS reference system)
**Role:** State of a budget/task/category

Never a pure 4–6px color dot as the sole piece of information (the original weakness). Always: color dot (min. 10px) **+** icon **+** text label. Example: "● ⚠ Over budget" instead of just a red dot.

### Progress Bar
**Role:** Budget progress, task progress

Track `rgba(255,255,255,0.3)` on the hero card, or `--color-hairline` on white cards, height 8px, radius 100px. Fill as a gradient or solid depending on context, **always accompanied by a numeric percentage/amount figure** right next to or above it — the bar alone is never the sole piece of information.

### Bottom Navigation
**Role:** Primary navigation between Finance/Household/Organization/Home

Background `--color-card-white`, border-top 1px `--color-hairline`, 4 items, each with a 48×48px tap area. Active state: 22×22px icon container with `--color-lavender-mist` fill, color `--color-violet-ink`; inactive `--color-dusk-helper`. Label always visible (never icon-only), Inter 700 10px.

### Input Field
**Role:** Form fields, search field

Background `--color-fog-surface`, border 1.5px `--color-hairline`, radius 14px, height ≥ 48px, padding 14px 16px, Inter 500 17px. Focus state: border `--color-violet-ink` + `--shadow-focus`.

## Do's and Don'ts

### Do
- Filled buttons for every primary action — contrast over restraint
- Always combine every status statement as color **+** icon **+** text, never color alone
- Limit the Aurora glow to a maximum of 1–2 surfaces per screen (hero card + one background blob) — otherwise the effect loses its impact and hurts legibility
- `tabular-nums` on every monetary amount for clean alignment
- At least 17px/500 for all body copy, at least a 44×44px tap area for every interactive element
- A visible focus ring (`--shadow-focus`) on every interactive element without exception
- Use Dusk Helper (`#736a82`) only for metadata at 14px and up, never for amounts, error messages, or calls to action

### Don't
- No ghost-outline buttons as a primary call to action
- No Violet Signal (`#7a5af8`) or Amber Glow (`#ffb75e`) as text color on a light background — only the "Ink" variants
- No negative letter spacing beyond −0.01em, not even on large headlines
- No pure color dots under 10px as the sole status information
- No glow/gradient on more than 1–2 surfaces at once
- No font weights under 500 for body copy

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Cloud Canvas | `#fdf9f2` | Page background |
| 1 | Lavender Mist | `#f7f5ff` | Ambient wash behind hero/feature blocks |
| 2 | Card White | `#ffffff` | Standard card surface |
| 3 | Hero Gradient | `linear-gradient(135deg, #7a5af8, #a78bfa, #ffb75e)` | Budget/hero card, the only strongly chromatic surface |

## Elevation

Elevation is primarily created through color steps (Canvas → Lavender Mist → Card White) plus a subtle `--shadow-card-soft` on standard cards. `--shadow-hero-glow` is deliberately the only "loud" elevation in the system and remains reserved for the hero card — that is the controlled frame for the wow effect.

## Imagery

No photography, no stock imagery. Visual interest comes from the Aurora gradient, soft glow surfaces, and the product UI itself (cards, progress bars, amounts set in Fraunces). Icons: simple, clear symbols (e.g., Tabler outline style), never smaller than 20px in interactive contexts.

## Layout

Mobile-first, content width up to 390px in the app context, up to 1200px on the public marketing/landing page. Dashboard rhythm: greeting → hero budget card → two mini stat cards side by side → section title → list of task rows → bottom nav. Base spacing between sections 18–20px, padding within cards 16–22px.

## Animation Philosophy

Motion stays restrained and functional: 0.2s ease for hover/focus states, no bounce, no parallax. **Correction in Version 2:** the original version allowed a gentle pulse on the hero card's Aurora glow — this contradicted the app's own "little animation" requirement for Persona B (60+) in `Gesamtkonzept.md`, Section 3, and was discovered during a direct comparison between the extravagant and minimalist versions. **The in-app context now specifies: no ambient/background animation at all, not even gated behind `prefers-reduced-motion`** — the safest implementation of "little animation" is no animation, not a conditionally-enabled effect that would still run wherever the media query isn't supported. In the marketing context (`website.html`) the pulse effect may remain, there exclusively disabled via `@media (prefers-reduced-motion: reduce)`, as originally specified. The only animation still permitted in both contexts: a very gentle fade-in when a card first loads (300–400ms), respecting `prefers-reduced-motion`.

## Dark Mode Tokens (extension, for later implementation)

A dark mode is planned for the younger target audience from the overall concept — as a **muted**, non-neon-intensified version of the "Midnight Signal" mood from the mockup comparison:

| Token | Light | Dark |
|-------|-------|------|
| `--color-cloud-canvas` | `#fdf9f2` | `#14121c` |
| `--color-card-white` | `#ffffff` | `#1e1b29` |
| `--color-midnight-plum` (primary text) | `#1a1523` | `#f4f2fb` |
| `--color-slate-violet` (secondary text) | `#4a4258` | `#c9c2e0` |
| `--color-violet-ink` (action) | `#5b3fd6` | `#9b86ff` |
| `--color-hairline` | `#ece7f7` | `#2e2a3d` |

Set glow effects in dark mode to **reduced opacity** (max. 0.25 instead of 0.45) — the same glow value reads noticeably more aggressive to light-sensitive eyes in the dark.

## Agent Prompt Guide

**Quick Color Reference**
- Primary text: `#1a1523` (Midnight Plum)
- Secondary text: `#4a4258` (Slate Violet)
- Metadata text: `#736a82` (Dusk Helper, 14px and up only)
- Canvas background: `#fdf9f2`
- Cards: `#ffffff`
- Primary action: `#5b3fd6` (Violet Ink), filled, never ghost-outline
- Decorative gradient: `#7a5af8 → #a78bfa → #ffb75e`, hero card only + max. 1 background blob

**Example Prompts**

1. **Hero budget card:** 28px radius, 135deg gradient from `#7a5af8` through `#a78bfa` to `#ffb75e`, 22px padding, `--shadow-hero-glow`. Amount in Fraunces 700 44px white with tabular-nums. Progress bar 8px, 100px radius, with a percentage figure alongside it.

2. **Primary button:** 100px pill radius, background `#5b3fd6`, white text Inter 700 17px, padding 14px 28px, tap area at least 44×44px, focus ring `--shadow-focus`.

3. **Task row with critical status:** white card, 16px radius, 1px border `#ece7f7`. A 10px dot in `#c23b52` with a light halo on the left, a warning icon next to it, then text "Rent overdue" in Inter 700 13px `#1a1523` — color, icon, and text together, never just the dot.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Text scaling — mandatory for the accessibility setting */
  --text-scale: 1; /* 1 / 1.15 / 1.3 depending on the user's setting */

  /* Colors */
  --color-cloud-canvas: #fdf9f2;
  --color-lavender-mist: #f7f5ff;
  --color-card-white: #ffffff;
  --color-midnight-plum: #1a1523;
  --color-slate-violet: #4a4258;
  --color-dusk-helper: #736a82;
  --color-hairline: #ece7f7;
  --color-fog-surface: #f4f1fc;
  --color-violet-ink: #5b3fd6;
  --color-violet-signal: #7a5af8;
  --color-amber-glow: #ffb75e;
  --color-amber-ink: #a15f14;
  --color-success-green: #1f8a4c;
  --color-danger-coral: #c23b52;

  /* Typography */
  --font-fraunces: 'Fraunces', ui-serif, Georgia, serif;
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --text-caption: calc(13px * var(--text-scale));
  --text-body-sm: calc(15px * var(--text-scale));
  --text-body: calc(17px * var(--text-scale));
  --text-body-lg: calc(19px * var(--text-scale));
  --text-subheading: calc(22px * var(--text-scale));
  --text-heading-sm: calc(24px * var(--text-scale));
  --text-heading: calc(32px * var(--text-scale));
  --text-display: calc(40px * var(--text-scale));
  --text-amount-hero: calc(44px * var(--text-scale));

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-14: 14px;
  --spacing-16: 16px;
  --spacing-18: 18px;
  --spacing-20: 20px;
  --spacing-22: 22px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-60: 60px;
  --spacing-80: 80px;

  /* Border Radius */
  --radius-mini-cards: 20px;
  --radius-task-rows: 16px;
  --radius-hero-card: 28px;
  --radius-feature-container: 40px;
  --radius-inputs: 14px;
  --radius-buttons: 100px;

  /* Touch Targets */
  --touch-target-min: 44px;
  --nav-target-min: 48px;

  /* Shadows */
  --shadow-card-soft: rgba(30, 20, 60, 0.10) 0px 10px 24px -14px;
  --shadow-hero-glow: rgba(122, 90, 248, 0.45) 0px 20px 40px -12px;
  --glow-ambient-violet: radial-gradient(circle, rgba(122,90,248,0.35), transparent 70%);
  --glow-ambient-amber: radial-gradient(circle, rgba(255,183,94,0.35), transparent 70%);
  --shadow-focus: 0 0 0 3px rgba(91, 63, 214, 0.35);
}

[data-theme="dark"] {
  --color-cloud-canvas: #14121c;
  --color-card-white: #1e1b29;
  --color-midnight-plum: #f4f2fb;
  --color-slate-violet: #c9c2e0;
  --color-violet-ink: #9b86ff;
  --color-hairline: #2e2a3d;
}
```

### Tailwind v4

```css
@theme {
  --color-cloud-canvas: #fdf9f2;
  --color-lavender-mist: #f7f5ff;
  --color-card-white: #ffffff;
  --color-midnight-plum: #1a1523;
  --color-slate-violet: #4a4258;
  --color-dusk-helper: #736a82;
  --color-hairline: #ece7f7;
  --color-fog-surface: #f4f1fc;
  --color-violet-ink: #5b3fd6;
  --color-violet-signal: #7a5af8;
  --color-amber-glow: #ffb75e;
  --color-amber-ink: #a15f14;
  --color-success-green: #1f8a4c;
  --color-danger-coral: #c23b52;

  --font-fraunces: 'Fraunces', ui-serif, Georgia, serif;
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --text-caption: 13px;
  --text-body-sm: 15px;
  --text-body: 17px;
  --text-body-lg: 19px;
  --text-subheading: 22px;
  --text-heading-sm: 24px;
  --text-heading: 32px;
  --text-display: 40px;
  --text-amount-hero: 44px;

  --radius-mini-cards: 20px;
  --radius-task-rows: 16px;
  --radius-hero-card: 28px;
  --radius-feature-container: 40px;
  --radius-inputs: 14px;
  --radius-buttons: 100px;
}
```

## What was deliberately NOT carried over 1:1 from the Aurora mockup

- **Ghost-outline buttons** from the original SaaS reference system were not adopted — primary actions are consistently filled.
- **Pure color dots as status** (as in the original pipeline-dot pattern) are always supplemented with icon + text.
- **Aggressive negative letter spacing** (−0.027 to −0.037em) was capped at max. −0.01em.
- The glow is no longer everywhere; it's concentrated on the hero card plus at most one background blob — that's the difference between "extravagant in one place" and "a little loud everywhere," and it follows the design rule "spend boldness in one place, keep the rest calm."