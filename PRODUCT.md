# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primär: Einzelpersonen, die ihren Alltag an einem Ort organisieren wollen. Dieselbe Plattform tragen Paare, Familien,
WGs und zeitweise Gruppen (z. B. Reisebegleitungen) — aber 4inOne ist eine persönliche Alltagsplattform, die gemeinsam
wird, wo die Person es wählt, keine „Familien-App, die Singles auch nutzen dürfen“ (docs/PRODUCT_VISION.md).

Typische Situation auf der App-Startseite (bestätigt 15.10.2026): ein kurzer Blick am Morgen, oft am Handy. Die erste
Frage ist „Was muss ich heute tun?“; die Bereiche liefern dazu je einen Stand.

## Product Purpose

Finanzen, Haushalt, Organisation und Reisen an einem Ort — jeder Bereich für sich vollständig nutzbar — und dazu
bewusste Verknüpfungen zwischen Einträgen verschiedener Bereiche. Erfolg: weniger doppelt organisieren, schneller
finden, was zusammengehört.

## Positioning

„Du organisierst etwas einmal. 4inOne verbindet, was dazu gehört.“ Der Unterschied ist die Verknüpfungsebene zwischen
echten Alltags-Objekten (Sparziel ↔ Gerät, Reise ↔ Termin …) mit erklärbaren Vorschlägen — nicht das bloße
Nebeneinander von Kalender, Liste und Budget (docs/COMPETITIVE_POSITIONING.md).

## Operating Context

Angular-Web-App (Rechner und Handy, Bottom-Navigation am Handy), Django-Backend. Startseite nach Login: Begrüßung,
Hinweise (Einladungen, E-Mail-Bestätigung), Stand der vier Bereiche, „Heute“ aus allen Bereichen, „Für dich“
(höchstens eine nächste Sache oder ein Verknüpfungs-Vorschlag), Schnellerfassung, Suche. Demo unter /demo mit
Beispieldaten.

## Capabilities and Constraints

- Live: vier Bereiche, Verknüpfungen V1, Vorschläge V1, Einladungen/Teilen für Haushalt und Reise.
- Nicht vorhanden und nicht zu behaupten: Automationen, KI, Banking-Anbindung, externe Kalender, Buchungen.
- Privat als Standard; Verknüpfungen geben keine Rechte; Finanzen sind nie teilbar.
- Gemeinsames erscheint nur, wenn wirklich geteilt wird (Mitglieder, Mitreisende) — Einzelperson zuerst.
- Offen (nicht entschieden, nicht behaupten): Preis- bzw. Beta-Status.

## Brand Commitments

Name „4inOne“, Zeichen aus vier weichen Feldern (`<app-brand>`), Leitsatz „Dein Alltag. Alles verbunden.“, Schrift
Instrument Sans, Sprache Deutsch in Du-Form, ruhig und erwachsen. Linke Navigation und bestehende Icons bleiben.

## Evidence on Hand

Echte Demo-Screenshots in frontend/public/images/landing. Keine Kund:innen, Zitate, Bewertungen oder Kennzahlen —
nichts davon erfinden.

## Product Principles

1. Heute zuerst: Die Startseite beantwortet in Sekunden, was heute ansteht.
2. Jeder Bereich trägt für sich; Verknüpfen ist ein Plus, keine Pflicht.
3. Privat als Standard, Teilen ist eine bewusste Entscheidung.
4. Nur Echtes zeigen: echte Daten, echte Funktionen, ehrliche Leerzustände.

## Accessibility & Inclusion

WCAG 2.1 AA (axe in den e2e-Tests), Tastatur vollständig, Klickflächen 44 px, reduzierte Bewegung respektiert.
