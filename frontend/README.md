# 4One Hub

Eine Plattform für vier Alltagsbereiche in einer App/Webseite &ndash; statt vieler Einzel-Apps: **Fitness**, **Finanzen**, **Organisation** und **Haushalt**.

## Idee

Viele Menschen nutzen heute für jeden Lebensbereich eine eigene App: eine für Training, eine fürs Budget, eine für Termine, eine für die Einkaufsliste &ndash; jeweils mit eigenem Login und eigener Benachrichtigung. 4One Hub bündelt diese vier Bereiche in einer Plattform mit einem gemeinsamen Konto und einem zentralen Dashboard.

Zielgruppe sind sowohl jüngere als auch ältere Nutzer:innen, die keine zehn Apps installieren wollen, sondern einen Ort für ihren Alltag.

## Bereiche

- **Fitness** &ndash; Trainingspläne, Workout-Log, Fortschritts-Statistiken, Ziele
- **Finanzen** &ndash; Budgetierung, Ausgabenerfassung, Sparziele, Abo-/Fixkosten-Tracker
- **Organisation** &ndash; Kalender, Aufgaben, Notizen, Erinnerungen
- **Haushalt** &ndash; Einkaufslisten, wiederkehrende Aufgaben, Vorräte, geteilte Zuständigkeiten

Alle vier Bereiche teilen sich ein Nutzerkonto (Registrierung/Login), ein Dashboard und zentrale Benachrichtigungen.

## Tech-Stack

| Bereich       | Technologie                              |
|---------------|-------------------------------------------|
| Frontend      | Angular (aktuelle Version)                |
| Backend       | Django + Django REST Framework            |
| Datenbank     | SQLite (Start) &rarr; PostgreSQL (Wachstum) |
| Auth          | Django Auth + JWT (Registrierung, Login)  |

Der Wechsel von SQLite zu PostgreSQL erfolgt über Djangos ORM-Abstraktion und erfordert primär eine Konfigurationsänderung statt eines Rewrites.

## Status

Konzeptphase. Eine ausführliche Markt- und Konzeptanalyse (Zielgruppen, Abo-Modell, Roadmap, Risiken) liegt als separates Dokument vor.

## Roadmap (grob)

1. Auth, zentrales Dashboard, Module Organisation &amp; Haushalt (MVP)
2. Modul Fitness
3. Modul Finanzen (manuelle Erfassung)
4. Skalierung: PostgreSQL-Migration, Haushalts-Freigabe, Abo-Einführung
5. Differenzierung: Bank-Sync, Wearable-Anbindung, bereichsübergreifende Auswertungen
