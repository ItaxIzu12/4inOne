# 4inOne — Design System Direction V2

## Design goal

The real product should feel:

- calm;
- modern;
- adult;
- friendly;
- trustworthy;
- understandable;
- not overly “AI-mockup-like”.

The interface should support long-term daily use rather than optimizing every screen for visual wow.

## Visual balance

Recommended product balance:

- approximately 80–85% normal product UI;
- approximately 15–20% illustration/3D/emotional visual accents.

Marketing material may use more expressive imagery than the daily product.

## Domain colors

Use a consistent orientation system:

- Finanzen — green
- Haushalt — pink/coral
- Organisation — purple
- Reisen — blue

Domain colors are accents, not backgrounds for entire dense screens.

Preferred pattern:

```text
white/light card
+ very light domain-tinted icon container
+ domain-colored icon/accent
+ neutral text
```

## Base surfaces

Prefer:

- white or warm off-white main surfaces;
- dark navy/charcoal primary text/navigation;
- restrained borders;
- subtle shadows;
- consistent card radius;
- generous spacing.

Avoid excessive gradients, glow effects and floating decorative objects in functional views.

## Icon system

Use one consistent icon family already available in the project where possible.

If Angular Material/Material Symbols is already established, prefer **Material Symbols Rounded**.

If a coherent family such as Lucide is already established, keep it rather than adding another library.

### Domain icons

Use stable concepts across the entire product:

- Finanzen — wallet/savings
- Haushalt — home
- Organisation — calendar/task
- Reisen — flight/travel

Do not change the main domain symbol between screens.

### Icon sizes

Suggested scale:

- utility: 16 px
- list: 20 px
- navigation: 22–24 px
- cards: 24–28 px
- section headers: 28–32 px

Do not use oversized 3D icons for ordinary data cards.

## 3D and illustration

Good uses:

- onboarding;
- landing/marketing;
- empty states;
- app-store imagery;
- occasional travel/hero moments.

Avoid as primary controls in:

- sidebar/bottom navigation;
- settings;
- finance transactions;
- task lists;
- calendars;
- forms;
- tables.

## Finanzen

Finances should be the most restrained domain.

Prioritize:

- clear numbers;
- readable charts;
- trust;
- minimal decoration;
- green as accent rather than full-page theme.

## Haushalt

Can feel warm and friendly, but tasks/information stay primary.

Device imagery may be used sparingly. Prefer normal device icons or small thumbnails over large decorative 3D appliances.

## Organisation

Should feel especially clean and productive.

Use simple calendar/task/reminder icons and restrained purple accents.

## Reisen

May be the most emotional domain.

Allowed:

- destination cover imagery;
- light illustrations;
- travel hero imagery.

Functional controls still use the same normal icon system as the rest of the product.

## Navigation

Inactive navigation:

- neutral navy/gray.

Active navigation:

- domain accent and/or light domain background.

Do not rely only on color; preserve text/shape/state cues.

## Profile menu

The top-right profile entry may open a compact menu with:

- Mein Profil
- Konto
- Personen & Gruppen
- Benachrichtigungen
- Datenschutz
- Einstellungen
- Hilfe
- Abmelden

The menu should feel simple rather than becoming a second sidebar.

## Accessibility

- icon-only buttons require accessible labels;
- state must not be communicated only by color;
- focus states remain visible;
- text and controls require sufficient contrast;
- touch targets should be comfortable on mobile.
