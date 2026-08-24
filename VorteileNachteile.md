# Kompass — Wettbewerbsvorteile & Nachteile

*Stand: August 2026. Basiert auf dem tatsächlich vorhandenen Code/den Architektur-Prompts, nicht nur auf der ursprünglichen Produktidee. Ergänzt das `Gesamtkonzept_AllInOne_App.md` (Marktanalyse) um einen konkreten, verteidigbaren Vergleich für Pitches/Vorstellungen.*

---

## Echte Unterscheidungsmerkmale — im Code verankert, nicht nur behauptet

| # | Merkmal | Wo im Code/Prompt verankert | Warum Wettbewerber das strukturell nicht haben |
|---|---|---|---|
| 1 | **Automatische Verknüpfung Einkauf → Budget → Kalender** | `finanzen.services.create_transaction_from_shopping_list()`, sichtbar als "fließt ins Budget"-Badge in der Timeline | Finanzguru/YNAB haben kein Haushaltsmodul, Bring!/Flatastic haben kein Budget — die Verknüpfung setzt beide Datenmodelle im selben System voraus |
| 2 | **Fairness-Anzeige** (wer hat wie viel eingebracht) | `created_by`-Feld auf `Transaction`, Aggregation pro `HouseholdMembership` | Setzt ein Mehrpersonen-Datenmodell voraus — Einzelnutzer-Apps wie YNAB können das strukturell nicht bauen, ohne ihr ganzes Modell umzubauen |
| 3 | **Echtes Rollenmodell** (Admin/Mitglied/Kind-Konto), serverseitig durchgesetzt | `HouseholdScopedPermission`, Rollenprüfung auf jedem Endpunkt, nicht nur im Frontend versteckt | Die meisten Budget-Apps sind für eine Person gebaut; ein Kind-Konto mit eingeschränktem Zugriff auf Finanzdaten ist keine Nachrüst-Funktion, sondern eine Grundsatzentscheidung im Datenmodell |
| 4 | **Barrierefreiheit von der ersten Zeile Code an** | Skip-Link, `role="progressbar"`, korrekte Heading-Hierarchie, 44px-Ziele, dauerhafter statt verschwindender Passwort-Hinweis | Bei etablierten Apps oft nachträglich aufgesetzt (wenn überhaupt) — bei Kompass verpflichtend im Prompt, nicht optional |
| 5 | **"Keine Bankverbindung nötig" aktiv als Vertrauensargument** | Manuelle Erfassung + Trust-Badges in `auth.html`/Dashboard | Fast jeder Wettbewerber wirbt mit Bankanbindung als Feature — Kompass dreht das bewusst um für die datenschutzbewusste, ältere Zielgruppe |
| 6 | **MFA-Brute-Force-Schutz getrennt vom Login-Rate-Limit** | Separates `RATE_LIMIT_MFA_VERIFY` im Backend-Prompt | Ein oft übersehenes Detail selbst bei größeren Apps — ein 6-stelliger TOTP-Code ohne eigenes Rate-Limit ist angreifbar, auch wenn der Login selbst geschützt ist |
| 7 | **Einladungs-Sicherheit ohne Account-Enumeration** | `HouseholdInvite` mit `secrets.token_urlsafe(32)`, identische Antwort unabhängig davon ob die E-Mail existiert | Für eine Mehrpersonen-App ein reales Risiko, das Einzelnutzer-Apps gar nicht erst haben — und das kaum eine kleinere Konkurrenz-App sauber löst |
| 8 | **Soft-Delete löst einen echten Rechtskonflikt** (DSGVO-Löschung vs. § 257 HGB/§ 147 AO) | `deleted_at`-Feld + `SoftDeleteManager` | Die meisten Budget-Apps kleinerer Anbieter haben diesen Konflikt vermutlich nie durchdacht |
| 9 | **Quantifiziertes "Warum" bei jedem Login** | "Warum"-Banner im Dashboard, zeigt echte Verknüpfungszahl der Woche | Kein Wettbewerber zeigt "das hat dir die App diese Woche konkret erspart" — die meisten zeigen nur Zahlen, keinen Beweis für den eigenen Nutzen |

---

## Ehrliche Nachteile — mit Einordnung, wann/ob sie behebbar sind

| Nachteil | Ehrliche Einordnung | Behebbar? | Wann realistisch |
|---|---|---|---|
| Keine automatische Bankanbindung | Aktuell manuell erfassen — echter Nachteil gegenüber Finanzguru/Outbank für bequemlichkeitsorientierte Nutzer | ✅ Ja | Bereits als **Phase 5** in der Roadmap vorgesehen (`Gesamtkonzept.md`, Abschnitt 10) — bewusst spät, weil PSD2-Lizenzkosten laufend sind und erst getragen werden sollten, wenn Nutzerbasis/Budget es hergeben |
| Keine KI-Kategorisierung | Wettbewerber erkennen Kategorien automatisch per ML, bei Kompass (noch) regelbasiert | ✅ Ja, technisch überschaubar | Nachrüstbar, sobald genug echte Transaktionsdaten für sinnvolle Kategorisierungsregeln/ein einfaches Modell vorliegen — kein Blocker, eher ein spätes Komfort-Feature |
| Kein Track Record, keine Marke | PayPal/N26 haben Millionen Nutzer und etabliertes Vertrauen | ⚠️ Nur langsam, nicht "gebaut" | Entsteht ausschließlich durch Zeit + zufriedene Nutzer — kein technisches Problem, keine Abkürzung möglich. Das ist der einzige Nachteil in dieser Liste, der sich nicht durch Entwicklungsarbeit beheben lässt |
| Organisation-Modul bewusst dünn | Bewusst kein Frontalangriff auf Google Kalender | ✅ Teilweise | Google-Kalender-Import/-Sync ist bereits als Ziel dokumentiert (`Gesamtkonzept.md`, Abschnitt 5) — das Modul bleibt aber strategisch schlank, das ist eine Entscheidung, kein Mangel, der komplett verschwinden soll |
| Langsamere Entwicklungsgeschwindigkeit | Solo-Entwicklung gegen finanzierte Teams | ⚠️ Nur begrenzt | Lässt sich durch die dünne-Scheiben-Methode und klare Priorisierung abfedern, aber nicht grundsätzlich auflösen, solange es ein Solo-Projekt bleibt |
| Noch keine mobile App im Store | Web/Capacitor-Basis existiert, kein veröffentlichter Store-Eintrag | ✅ Ja | Bereits in der Roadmap vorgesehen, aber realistisch nicht dieses Jahr — siehe `Gesamtkonzept.md`, Abschnitt 10.1 (Web-Beta zuerst) |
| Fairness-Anzeige/Rollenmodell nutzt nur Mehrpersonenhaushalten | Für Solo-Nutzer ist der Haupt-USP schwächer | ⚠️ Bedingt | Ließe sich durch zusätzliche Solo-spezifische Vorteile abfedern (z. B. reine Verknüpfungsvorteile ohne Fairness-Bezug), aber der Kern des USP bleibt an Mehrpersonenhaushalte geknüpft — das ist eine bewusste Zielgruppen-Entscheidung, keine offene Baustelle |

---

## Kurz zur Frage "kann ich das später beheben"

**Ja, für die meisten Punkte** — vier der sieben Nachteile stehen bereits als geplante spätere Phasen im Gesamtkonzept, das ist keine neue Zusage, sondern Bestätigung des bestehenden Plans. Zwei sind nur *begrenzt* behebbar (Entwicklungsgeschwindigkeit, Zielgruppen-Bindung des USP) — das sind strukturelle Eigenschaften eines Solo-Mehrpersonenhaushalt-Produkts, keine Bugs. **Einer ist grundsätzlich nicht "baubar"**: Track Record und Markenvertrauen entstehen nur durch Zeit und echte zufriedene Nutzer, keine Entwicklungsarbeit beschleunigt das. Genau deshalb war die Kundengewinnungsstrategie (organisches Wachstum über Haushaltseinladungen, `Gesamtkonzept.md` Abschnitt 11) so wichtig — sie ist der einzige Hebel, der auf diesen einen unbehebbaren Nachteil überhaupt einwirkt.

---

## Empfehlung für die Pitch-Formulierung

Nicht "wir sind besser als X", sondern an einem konkreten Moment zeigen: *"Finanzguru kennt euer Budget, aber nicht eure Einkaufsliste. Bring! kennt eure Einkaufsliste, aber nicht euer Budget. Kompass ist die einzige App, bei der ein abgehakter Einkauf automatisch im Budget landet — ohne dass du es nochmal eintippst."* Punkte 1–4 aus der oberen Tabelle sind die stärksten für einen Pitch, weil sie im Datenmodell verankert sind, nicht nur UI-Politur.