# Kompass — Finanzen-Tab: Konzeptdokument

*Konsolidierte, verbindliche Referenz. Fasst alle Entscheidungen aus Gesamtkonzept.md (Abschnitte 5.1–5.4) und Architektur.md zusammen, die bisher über mehrere Chat-Sitzungen verstreut entstanden sind — dieses Dokument ersetzt das Nachschlagen an fünf verschiedenen Stellen.*

---

## 1. Der Grundgedanke in einem Satz

Der Finanzen-Tab beantwortet zwei unterschiedliche Fragen, die bewusst als zwei getrennte, aber miteinander verbundene Ansichten abgebildet werden:

- **"Wie viel habe ich wofür ausgegeben?"** → Tab **Übersicht**
- **"Wie viel bleibt mir am Ende wirklich übrig?"** → Tab **Analysen**

Beide greifen auf dieselben zugrunde liegenden Daten zu und sind rechnerisch miteinander verbunden — keine zwei unabhängigen Systeme.

---

## 2. Tab "Übersicht" — was ausgegeben wurde

### 2.1 Budget-Kopfzeile

**Korrektur gegenüber früheren Entwürfen:** Die Begriffe "verplant"/"übrig" stammten ursprünglich aus dem Zero-Based-Envelope-Konzept (Abschnitt 7), das bewusst verworfen wurde — die Sprache blieb fälschlich stehen, obwohl sie zum tatsächlichen System nicht mehr passte. Außerdem war die Kopfzeilen-Zahl in früheren Mockups nie tatsächlich aus den Kategorien darunter berechnet, sondern eine freistehende Beispielzahl.

**Korrekte Definition, jetzt verbindlich:**
```
Ausgegeben (große Zahl) = SUM(Kategorie "ausgegeben" aller Kategorien)
Gesamtziel ("von X €")  = SUM(Category.monthly_goal aller Kategorien)
Übrig                    = Gesamtziel − Ausgegeben
Prozent-Anzeige          = Ausgegeben / Gesamtziel × 100, Bezeichnung "ausgegeben", NICHT "verplant"
```
Zeigt den Gesamtstand des Monats: wie viel von den Kategorienzielen bereits ausgegeben ist, als große Kennzahl mit Fortschrittsbalken.

### 2.2 Kategorien mit Budgetzielen
Jede Kategorie (Fixkosten, Haushalt, Sonstiges als automatisch erzeugte Standard-Kategorien; weitere frei anlegbar) hat:
- Ein optionales monatliches Ziel (`monthly_goal`)
- Einen live berechneten "ausgegeben"-Betrag
- Eine Farbe und ein Icon (frei wählbar bei eigenen Kategorien, aus einer kuratierten Palette/Icon-Auswahl)

Ein Antippen einer Kategorie-Zeile öffnet ein Sheet zum Ändern des Budgetziels — kein eigener Tab dafür nötig.

### 2.3 Faire Aufteilung (Fairness-Anzeige)
Zeigt, welcher Anteil der Ausgaben von welchem Haushaltsmitglied stammt. **Nur sichtbar ab zwei Haushaltsmitgliedern** — bei einem Einzelhaushalt ergäbe eine Prozentaufteilung keinen Sinn und wird komplett aus dem DOM entfernt, nicht nur ausgeblendet.

### 2.4 Letzte Transaktionen + "Alle anzeigen"
Zeigt die letzten Einträge. "Alle anzeigen" öffnet ein **Modal-Fenster** mit vollständiger, durchsuchbarer Liste (Cursor-Pagination) — keine eigene Route.

### 2.5 Abo-Radar
Zeigt erkannte wiederkehrende Ausgaben mit dem Hinweis "Nutzt das noch jemand?" bei Kategorien, die einem inaktiven Haushaltsmitglied zugeordnet waren.

### 2.6 "Für KI-Analyse exportieren"
Erzeugt einen fertig formatierten Textblock (Kategorien, Transaktionen der letzten 3 Monate, Einkommens-Gesamtsumme falls vorhanden) plus einen Beispiel-Prompt, den der Nutzer selbst in ein KI-Werkzeug seiner Wahl einfügt. **Keine eigene KI-Anbindung, kein API-Aufruf an ein Sprachmodell** — das ist eine bewusste, kostenfreie Alternative zu einer eingebauten KI (siehe Abschnitt 6).

---

## 3. Tab "Analysen" — was am Ende übrig bleibt

### 3.1 Einkommen
Jedes Haushaltsmitglied kann sein eigenes monatliches Einkommen hinterlegen — eine einzelne Zahl. **Datenschutz-Regel:** Die individuelle Zahl ist ausschließlich für die Person selbst sichtbar, niemals für andere Haushaltsmitglieder im API-Response enthalten. Nur die kombinierte Haushalts-Gesamtsumme fließt in gemeinsame Berechnungen ein.

### 3.2 Feste, wiederkehrende Abzüge (`RecurringDeduction`)
Miete, Verträge, Abos — einmal hinterlegt (Name, Betrag, Kategorie), nicht monatlich neu eingetragen. **Wichtige Regel:** Diese Beträge gehören ausschließlich hierhin, niemals zusätzlich als einzelne Transaktion — sonst werden sie doppelt gezählt.

### 3.3 Puffer
Ein frei wählbarer Betrag für Sparen/Rücklagen, ebenfalls automatisch abgezogen.

### 3.4 "Verfügbares Einkommen" — die zentrale Kennzahl
```
Verfügbares Einkommen =
    Haushalts-Gesamteinkommen
  − Summe aller aktiven festen Abzüge
  − Summe aller einzeln erfassten Transaktionen des laufenden Monats
  − Puffer
```
Jede in der Übersicht erfasste Ausgabe wirkt sich hier unmittelbar aus — das ist die Verbindung zwischen beiden Tabs.

### 3.5 Regelbasierte Hinweise ("Analyse")
Feste Schwellenwert-Regeln in Python, **keine echte KI**, kein LLM-Aufruf:
- Fixkosten-Anteil > 50 % des Einkommens → Warnhinweis
- Puffer-Anteil < 10 % des Einkommens → Hinweis
- Beides im gesunden Bereich → positive Bestätigung

---

## 4. Wie beide Tabs rechnerisch zusammenhängen

```
Kategorie "ausgegeben" (Übersicht) =
    Transaktionen dieser Kategorie im laufenden Monat
  + feste Abzüge, die dieser Kategorie zugeordnet sind

Verfügbares Einkommen (Analysen) =
    Gesamteinkommen − alle festen Abzüge − alle Transaktionen − Puffer
```

Eine Ausgabe verändert also **beide** Ansichten gleichzeitig — nicht zwei getrennte, unabhängige Zahlensysteme.

---

## 5. Sicherheits- und Datenschutzregeln (Zusammenfassung)

| Regel | Warum |
|---|---|
| `HouseholdScopedPermission` auf jedem Endpunkt | Verhindert Zugriff auf fremde Haushaltsdaten über erratene IDs |
| Individuelles Einkommen nie im Response anderer Mitglieder | Einzige wirklich private Information im sonst gemeinsam sichtbaren Haushaltsmodell |
| Kategorie-Farbe/Icon serverseitig validiert | Verhindert CSS-Injection bzw. fehlende Icon-Zuordnung |
| Mengenbegrenzung bei Kategorien (max. 15) | Schutz gegen versehentliche/missbräuchliche Massenerstellung |
| Rate-Limit auf Export- und Such-Endpunkten | Schutz gegen Bulk-Abgreifen von Daten |
| `is_default` nie clientseitig setzbar | Schutz der drei automatisch erzeugten Standard-Kategorien |
| Export enthält keine externen KI-API-Aufrufe | Kein neues Sicherheitsrisiko, keine laufenden Kosten |

---

## 6. Warum keine Bankanbindung und keine eingebaute KI (bewusste Entscheidungen, nicht Lücken)

- **Keine Bankanbindung:** Aktiv als Vertrauensvorteil kommuniziert ("Keine Bankverbindung nötig — wir sehen deine Bankdaten nicht"), nicht als fehlendes Feature entschuldigt. Trifft eine reale Marktlücke bei datenschutzbewussten Nutzern.
- **Keine eingebaute KI:** Era-inspiriertes Prinzip — Daten werden für die freie KI-Wahl des Nutzers exportierbar gemacht, statt eine eigene, kostenpflichtige KI-Anbindung mit neuer Sicherheitsfläche (Prompt-Injection) einzubauen.

---

## 7. Was bewusst NICHT Teil des Finanzen-Tabs ist

- Kein Zero-Based-Envelope-Budgeting (erwogen, verworfen — zu tippaufwändig, zu komplex für die Zielgruppe)
- Kein separater "Budgets"-Tab (Budgetziel bleibt in der Übersicht antippbar)
- Kein separater "Transaktionen"-Tab (bleibt im Modal)
- Keine öffentlich zugängliche, bearbeitbare Finanzen-Demo (Anmeldung ist für jede echte Dateneingabe zwingend — Sicherheits-/Datenschutzgrund, siehe Abschnitt 5)