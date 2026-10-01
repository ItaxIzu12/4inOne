# Visuelles Refactoring – 1. Oktober 2026

## Icon-System

Vorhandene eigene SVG-Outline-Komponenten bleiben die einzige Icon-Familie. Keine neue Abhängigkeit; Angular Material, Material Symbols und Lucide sind nicht eingebunden. Domain-Geometrien liegen zentral in `domain-icon-paths.ts`; bestehende Selektoren bleiben kompatibel.

Vereinheitlicht: Geldbeutel (Finanzen), Haus statt Einkaufstasche (Haushalt), Kalender (Organisation), Flugzeug statt Papierflieger (Reisen) und Zahnrad (Einstellungen). Die vorhandenen flachen SVGs ersetzen weiterhin die früheren glänzenden Haupticons; diese waren bereits vor diesem Arbeitsschritt entfernt. Keine PNG-/Emoji-Haupticons mussten in den untersuchten aktuellen Domain-Ansichten ersetzt werden.

Navigation: 24-px-Icons, neutrale inaktive Einträge, farbige aktive Einträge mit hellem Hintergrund und weiterhin Text/aria-current. Header-Icons höchstens 32 px, Domain-Karten 28 px. Sichtbare Fokusumrandung bleibt erhalten.

## Oberflächen

Neutraler App-Hintergrund, weiße Karten, weniger Verläufe und Schatten. Dekorative Domain-Wasserzeichen im Dashboard entfernt. Finanzbereich besonders zurückhaltend. Reise-Cover, Markenlogo sowie bestehende Onboarding-/Marketingillustrationen bleiben erhalten. Daten, APIs, Routing und Berechtigungen wurden in diesem Arbeitsschritt nicht verändert.

## In diesem Arbeitsschritt geänderte Dateien

Alle Frontendpfade relativ zu `frontend/`:

- `src/app/shared/icons/domain-icon-paths.ts` (neu)
- `src/app/shared/icons/app-icon.ts`
- `src/app/shared/icons/icon-finanzen.ts`
- `src/app/shared/icons/icon-haushalt.ts`
- `src/app/shared/icons/icon-organisation.ts`
- `src/app/shared/icons/icon-settings.ts`
- `src/app/layout/app-shell.html`
- `src/app/layout/app-shell.scss`
- `src/app/features/dashboard/dashboard.html`
- `src/app/features/dashboard/dashboard.scss`
- `src/app/features/finanzen/private-finance.scss`
- `src/app/features/haushalt/haushalt.scss`
- `src/app/features/organisation/organisation.scss`
- `src/app/features/reisen/reisen.scss`
- `e2e/visual-refactor.spec.ts` (neu)

Zusätzlich dieser Bericht. Andere bereits vorhandene Repositoryänderungen gehören nicht zu diesem Refactoring.

## Prüfung

- 275 Frontendtests erfolgreich.
- Angular-Produktionsbuild einschließlich Template-/TypeScript-Prüfung erfolgreich.
- Responsive Browserprüfung: Dashboard, Finanzen, Haushalt, Organisation und Reisen jeweils bei 390, 820 und 1440 px; Kontomenü öffnen/schließen, aktive Navigation, keine horizontalen Überläufe, Axe WCAG A/AA ohne gemeldete Verstöße.
- Browserprüfung verwendet die öffentlichen, isolierten Demo-Ansichten. Authentifizierte Datenflüsse wurden nicht zusätzlich im Browser geprüft.
- Screenshots unter `frontend/test-results/visual-*.png`; Dashboard/Desktop und Finanzen/Mobile zusätzlich visuell gesichtet.
- Kein Backend geändert; keine Backendtests oder Migrationen erforderlich.

## Verbleibende Unterschiede

Ältere Haushaltsfinanzansicht und einzelne spezialisierte SVG-Komponenten bleiben erhalten; sie verwenden ebenfalls Outline-Icons, sind aber noch nicht alle auf eine gemeinsame Geometriedatei umgestellt. Kleine Unterschiede in Rundungen bleiben möglich. Authentifizierungsformulare behalten ihre bestehenden Inline-SVGs. Reise-Cover und Onboarding dürfen bewusst illustrativer bleiben.

Bestehende Buildwarnung: `finanzen.scss` der älteren Finanzansicht ist mit 16,69 kB über dem Warnbudget von 12 kB. Kein Buildfehler.
