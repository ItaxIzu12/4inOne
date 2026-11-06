# Beta-Test 4inOne (Entwicklungsplan Phase 5)

**Ziel:** Nachweisen, ob Menschen ohne technische Erklärung verstehen, was die Verbindungen zwischen den Bereichen tun,
ob sie dabei Zeit sparen und die Kontrolle behalten — und ob sie 4inOne wiederholt nutzen.
**Nicht Ziel:** Lob sammeln. Positive Rückmeldungen allein gelten nicht als Nachweis langfristiger Nutzung.

## Rahmen

| | |
|---|---|
| Personen | **5–10**, möglichst gemischt: allein lebend, Paar/WG, Familie; mindestens 2 ohne Technik-Hintergrund |
| Dauer | **2–4 Wochen** (Vorschlag: 3 Wochen) |
| Termine je Person | Start (60 min, begleitet) · Woche 1 kurze Nachfrage (10 min) · Abschluss (30 min) |
| Konten | Jede Person legt ihr **eigenes Konto** an (keine geteilten Zugänge). Für die A/B-Prüfung ein Paar in einen gemeinsamen Haushalt einladen lassen |
| Daten | Echte oder ausgedachte Daten — die Person entscheidet. Bitte **keine** echten Konto-, Vertrags- oder Ausweisnummern |

## Unterlagen

| Datei | Wofür |
|---|---|
| [AUFGABEN.md](AUFGABEN.md) | die fünf Aufgaben für Testpersonen (zum Ausdrucken/Vorlesen) |
| [BEOBACHTUNGSBOGEN.md](BEOBACHTUNGSBOGEN.md) | je Person und Aufgabe: geschafft? Zeit, Hilfe, Stolperstellen, Zitate |
| [INTERVIEWLEITFADEN.md](INTERVIEWLEITFADEN.md) | Fragen zu Start, Zwischenstand und Abschluss — ohne Suggestivfragen |
| [EINWILLIGUNG.md](EINWILLIGUNG.md) | Vorlage für die Einwilligung (vor dem Start unterschreiben lassen) |
| [AUSWERTUNG.md](AUSWERTUNG.md) | Vorlage für Ergebnis, Problemliste und Entscheidung (Definition of Done Phase 5) |

## Technik (Betreiber)

1. Migrationen ausführen: `python manage.py migrate` (neu: `core/0017_beta_feedback`).
2. In der `.env` des Servers: `BETA_FEEDBACK_ENABLED=True` (Standard: aus). Dann erscheint im Kontomenü
   **„Feedback geben · Beta“** — nur für angemeldete Personen, nie in der Vorschau `/demo`.
3. Optional: `BETA_FEEDBACK_RETENTION_DAYS` (Standard 180); `cleanup_expired` löscht ältere Rückmeldungen.
4. Auswertung (pseudonym, P1, P2 …):
   - `python manage.py beta_feedback_report --output beta-feedback.md` — Antworten je Aufgabe und Bereich, Freitexte
   - `python manage.py beta_usage_report --since JJJJ-MM-TT --until JJJJ-MM-TT [--users a@x.de,…] --output beta-nutzung.md`
     — an wie vielen Tagen/Wochen welche Bereiche genutzt wurden (nur Zeitstempel, keine Inhalte)
5. Die erzeugten Berichte enthalten Freitexte der Testpersonen: **nicht ins Repository einchecken**, vor dem
   Weitergeben auf persönliche Angaben durchsehen.
6. Nach dem Test `BETA_FEEDBACK_ENABLED=False`.

## Ablauf

1. **Vorbereitung (Woche 0):** Personen einladen, Einwilligung, Termin für den Start. Server erreichbar, Migrationen
   ausgeführt, Feedback eingeschaltet. Eine Probe-Session mit einer Person aus dem Team.
2. **Start (Tag 1, begleitet):** Interview Teil A (5 min) → Aufgaben 1–5 mit lautem Denken, beobachten und
   protokollieren, **nicht helfen**, solange die Person nicht festhängt (dann Hilfe notieren) → Interview Teil B.
3. **Freie Nutzung (Woche 1–3):** Die Person nutzt 4inOne im Alltag und schickt Rückmeldungen über „Feedback geben“.
   Nach Woche 1 kurze Nachfrage (Teil C).
4. **Abschluss:** Interview Teil D, Fragebogen im Dialog „Feedback geben“ mit Aufgabe „T5“.
5. **Auswertung:** beide Berichte erzeugen, [AUSWERTUNG.md](AUSWERTUNG.md) ausfüllen, Probleme priorisieren, Blocker
   beheben, Ergebnis in `docs/RELEASE_READINESS.md` eintragen.
