# Kompass

Eine Plattform für drei Alltagsbereiche in einer App/Webseite &ndash; statt drei bis vier Einzel-Apps: **Finanzen**, **Haushalt** und **Organisation**.

## Idee

Viele Menschen nutzen heute für jeden Lebensbereich eine eigene App: eine fürs Budget, eine für die Einkaufsliste, eine für Termine &ndash; jeweils mit eigenem Login und eigener Benachrichtigung. Kompass bündelt diese drei Bereiche in einer Plattform mit einem gemeinsamen Konto und echten Querverbindungen zwischen den Modulen (z.&nbsp;B. Einkaufsliste &rarr; Budget, wiederkehrende Aufgaben &rarr; Kalender).

Zielgruppe sind sowohl jüngere als auch ältere Nutzer:innen, die keine zehn Apps installieren wollen, sondern einen barrierefreien Ort für ihren Alltag &ndash; siehe `GESAMTKONZEPT.md` §3.

## Bereiche

- **Finanzen** &ndash; Budget, wiederkehrende Ausgaben, geteilte Haushaltskasse
- **Haushalt** &ndash; Einkaufsliste, Aufgabenverteilung, Putz-/Wartungspläne
- **Organisation** &ndash; gemeinsamer Kalender, Erinnerungen, To-dos (mit Google-Kalender-Sync statt Eigenbau)

Ein Fitness-Modul wurde bewusst gestrichen &ndash; Begründung in `GESAMTKONZEPT.md` §1 (Art.&nbsp;9 DSGVO, Wettbewerbsdichte).

Alle drei Bereiche teilen sich ein Nutzerkonto (Registrierung/Login) und eine Startseite mit Wochenüberblick.

## Tech-Stack

| Bereich       | Technologie                              |
|---------------|-------------------------------------------|
| Frontend      | Angular (aktuelle Version)                |
| Backend       | Django + Django REST Framework            |
| Datenbank     | SQLite (lokal/Tests) &rarr; PostgreSQL (ab erstem Server-Deployment) |
| Auth          | Django Auth + JWT, MFA für Finanzfunktionen verpflichtend |

Details, Security-Konzept (Autorisierung, Verschlüsselung, Session-Management) und Performance stehen in `../ARCHITEKTUR.md`.

## Design

Design-Tokens und Komponenten-Referenz in `DESIGN_SYSTEM.md` (Handwerks-Referenz: ein zurückhaltender Akzent, Pill-Buttons, weiche Schatten, ruhige Typografie). Konkrete Kompass-Umsetzung: warmes Creme/Lavendel, Fraunces (Display) + Inter (Text), Violett als Signalfarbe mit Amber (Haushalt) und Grün (Organisation) als Modulfarben.

## Status

Konzeptphase, Frontend-Grundgerüst mit Startseite, Auth-Platzhalter und drei Modul-Vorschauseiten steht. Ausführliche Markt-, Rechts- und Roadmap-Analyse in `../GESAMTKONZEPT.md`.

## Roadmap (grob, siehe `../GESAMTKONZEPT.md` §9 für Details)

1. Fundament: Auth/MFA, Design-System-Basis, Datenschutzerklärung/Impressum/AGB
2. Ein starkes Modul: Haushalt + Finanzen manuell, inkl. Querverbindung als Kern-USP
3. Drittes Modul: Organisation (Kalender/To-dos) inkl. Google-Kalender-Sync
4. Barrierefreiheits-Audit & Accessibility-Statement (BFSG-Pflicht)
5. Beta mit echten Nutzer:innen beider Zielgruppen, Sicherheitsaudit
6. Banking-API-Anbindung (FinAPI/Tink), erst wenn das Kostenmodell trägt
