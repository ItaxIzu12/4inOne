# ADR-001 — Eigentümerschaft und Freigaben

**Status:** Vorschlag, wartet auf Entscheidung
**Datum:** 24. September 2026
**Betrifft:** D-002, D-004, `DATA_MODEL.md` („owner_scope“), `AUTH_AND_PERMISSIONS.md`, Roadmap Phase 2

## 1. Warum jetzt

Jede Funktion, die auf dem heutigen Modell entsteht, macht die spätere Umstellung teurer. Im Moment ist sie so billig wie nie wieder:

- In der lokalen Datenbank gibt es 8 Haushalte, **alle mit genau einem Mitglied**.
- Einladungen werden gespeichert, aber es gibt **keinen Ablauf zum Annehmen** (`core/household_views.py`). Geteilte Daten existieren also noch nirgends.
- Gerade entsteht in `organisation/` ein **zweites Muster** (`PersonalEvent`/`PersonalTask` mit `owner`-Fremdschlüssel). Wird es festgeschrieben, bevor diese Entscheidung fällt, gibt es dauerhaft zwei Arten, Eigentum auszudrücken.

## 2. Ist-Zustand

| Muster | Modelle |
|---|---|
| Gehört einem **Haushalt** | `finanzen`: Account (→ Transaction), Category, RecurringDeduction, Budget · `haushalt`: ShoppingList, ItemMemory, ShoppingTrip, Task, TaskCompletion, FolderEntry · `organisation`: CalendarEvent · `core`: Notification |
| Gehört einer **Person** | `organisation`: PersonalEvent, PersonalTask (in Arbeit) · `core`: OnboardingProfile, MFA, Passwort-Reset |

Die Registrierung legt für jede Person einen eigenen Haushalt an. Heute ist „Haushalt“ damit in Wahrheit der **persönliche Bereich**. Sobald jemand eingeladen wird, sähe die eingeladene Person aber **alle** Finanzen, den ganzen Haushaltsordner und den ganzen Kalender. Das widerspricht D-004.

An 25 Stellen wird der Haushalt mit `request.user.households.first()` bestimmt, also stillschweigend der erste.

## 3. Anforderungen aus den Docs

1. Jeder Bereich ist allein nutzbar, ohne Haushalt und ohne Familie (D-002).
2. Privat als Standard; Mitgliedschaft allein gibt keinen Zugriff auf private Finanzen (D-004).
3. Eine Freundin kann einer Reise beitreten, ohne Haushalt oder Finanzen zu sehen (`PRODUCT_REQUIREMENTS.md` §10).
4. Kind- oder eingeschränkte Mitglieder: keine Finanzen, begrenzt Haushalt und Organisation (`AUTH_AND_PERMISSIONS.md`).
5. Rollen bewusst wenige: owner, member, viewer.
6. Berechtigungen im Backend, pro Objekt. Eine Connection gewährt nie selbst Zugriff.
7. SQLite jetzt, PostgreSQL später, keine datenbankspezifischen Tricks.

## 4. Optionen

### A — Alles bleibt am Haushalt, „persönlich“ = Einpersonen-Haushalt
Einladen heißt: Man teilt alles.
- ➕ keine Migration
- ➖ verletzt D-004 grundsätzlich; Reise mit Freundin (Anforderung 3) ist nicht abbildbar
- **Verworfen.**

### B — `owner` (Person) an jedem Datensatz, plus optional `household` für Geteiltes
Sichtbar ist ein Datensatz für den Eigentümer oder, wenn `household` gesetzt ist, für alle Mitglieder.
- ➕ sehr direkt, leicht zu verstehen
- ➖ Mit Reisen kommt ein drittes optionales Feld (`trip`) dazu, dann Gruppen – jede Abfrage und jede Berechtigung braucht Verzweigungen. Bei zwei gesetzten Feldern ist unklar, was gilt.
- ➖ Rollen (viewer, Kind) lassen sich pro Datensatz schlecht ausdrücken.

### C — Ein gemeinsamer Begriff „Bereich“: jeder Datensatz gehört genau einem Bereich
Ein Bereich ist eine Art Container mit Mitgliedern und Rollen. Arten: **persönlich** (genau eine Person, nicht teilbar), **Haushalt** (geteilt), später **Reise** und **Gruppe**.
- ➕ Genau ein Fremdschlüssel pro Datensatz, eine Berechtigungsregel: „Ist die Person Mitglied im Bereich des Datensatzes, und darf ihre Rolle das?“
- ➕ Die Freundin wird Mitglied im Reise-Bereich und sieht sonst nichts. Anforderung 3 erfüllt, ohne Sonderfall.
- ➕ Passt zum Begriff `owner_scope` in `DATA_MODEL.md`.
- ➖ Eine Umbenennung im Denken: „Haushalt“ ist nur noch eine Art von Bereich.

## 5. Empfehlung: C, als kleinste sichere Änderung

**Den bestehenden `Household` zum Bereich verallgemeinern, statt eine neue Tabelle einzuführen.** Alle 12 vorhandenen Fremdschlüssel bleiben, wie sie sind.

1. **`Household` bekommt ein Feld `kind`**: `personal` · `household` · später `trip`, `group`. Alle bestehenden Haushalte werden zu `personal`, was sie heute faktisch sind. Ein Umbenennen der Klasse (z. B. in `Space`) ist optional und kann später erfolgen.
2. **Persönliche Bereiche sind nicht teilbar.** Einladungen gehen nur in Bereiche der Art `household` (später `trip`). Wer teilen will, legt ausdrücklich einen gemeinsamen Haushalt an. Das ist der „bewusste Schritt“ aus D-004.
3. **Neue Datensätze landen standardmäßig im persönlichen Bereich.** Wer in einem gemeinsamen Haushalt ist, wählt beim Anlegen (oder per Voreinstellung pro Modul) den Bereich. Einen Datensatz zu verschieben ist eine ausdrückliche Aktion.
4. **Finanzen:** Private Buchungen bleiben im persönlichen Bereich. Gemeinsame Kosten stehen im Haushaltsbereich. Die „faire Aufteilung“ rechnet nur über den Haushaltsbereich.
5. **Rollen pro Mitgliedschaft:** Die vorhandenen Rollen werden abgebildet: `ADMIN` → owner, `MEMBER` → member, `CHILD_ACCOUNT` → restricted (keine Finanzen). `viewer` kommt erst mit Reisen.
6. **Eine zentrale Stelle für Berechtigungen:** `HouseholdScopedPermission` bleibt die Prüfung pro Objekt. Neu kommt eine Funktion „welche Bereiche darf diese Person für dieses Modul lesen oder schreiben“ hinzu. Sie ersetzt die 25 `households.first()`. Bereichs-IDs vom Client werden immer gegen die Mitgliedschaft geprüft.
7. **`PersonalEvent`/`PersonalTask`** bekommen statt `owner` den persönlichen Bereich. So ist das Muster überall gleich, und ein Termin kann später in einen Haushalt verschoben werden. Das sollte **vor** dem Commit der laufenden Organisation-Arbeit entschieden werden.
8. **Connections** (Phase 6) speichern zwei Objekte. Beim Lesen wird jede Seite über ihren Bereich einzeln geprüft (`CONNECTION_ENGINE.md` „Authorization“).

## 6. Migrationsschritte (je ein kleiner, prüfbarer Schritt)

1. Feld `kind` am Haushalt, bestehende Datensätze → `personal`. Keine Verhaltensänderung.
2. Einladungen in persönliche Bereiche sperren. Einen Endpunkt zum Anlegen eines gemeinsamen Haushalts ergänzen und einen Ablauf zum Annehmen von Einladungen bauen.
3. `households.first()` durch die zentrale Bereichsauflösung ersetzen. Ohne Angabe gilt der persönliche Bereich, mit Tests gegen fremde Bereiche.
4. Organisation auf das Bereichsmuster umstellen (Punkt 5.7).
5. Frontend: eine Bereichsauswahl nur anzeigen, wenn es überhaupt einen gemeinsamen Bereich gibt. Personen ohne Haushalt sehen keinen zusätzlichen Schritt.
6. Automatische Kalendereinträge des Haushalt-Moduls (Aufgaben, Ordnerfristen) landen im Bereich ihres Ursprungs und werden mit Connection V1 zu Vorschlägen (D-009).

## 7. Offene Fragen an dich

1. **Name:** Wie soll der Oberbegriff in der Oberfläche heißen: „Bereich“, „Space“, oder gar nicht sichtbar (nur „Privat“ / „Haushalt Müller“ / „Reise Japan“)?
2. **Finanzen teilen:** Nur ganze Buchungen im Haushaltsbereich, oder auch „privat, aber mit Betrag für die Aufteilung sichtbar“?
3. **Mehrere Haushalte:** Darf eine Person in mehreren gemeinsamen Haushalten sein (z. B. WG und Familie)? Das Modell kann es, die Oberfläche wäre aufwendiger.
4. **Kind-Konten:** Reicht die Regel „keine Finanzen, Haushalt und Organisation ja“, oder brauchen Kinder auch nur Lesezugriff auf manche Haushaltsdaten?

## 8. Folgen

- Bestehende Funktionen laufen unverändert weiter. Schritt 1 ändert kein Verhalten.
- Das Haushalt-Modul muss nicht neu gebaut werden, nur die Bereichsauflösung tauscht sich aus.
- Die Erweiterungen Reisen und Gruppen brauchen später kein neues Berechtigungsmodell.
- Risiko: Schritt 3 berührt viele Views. Er muss durch Tests abgesichert sein, dass fremde Bereiche weder lesbar noch beschreibbar sind.
