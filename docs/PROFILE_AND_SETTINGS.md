# Lumiknot — Profile and Settings

## Entry point

The top-right user/avatar control opens a compact profile menu and provides access to the full settings area.

## Quick profile menu

Recommended items:

- Mein Profil
- Konto
- Personen & Gruppen
- Benachrichtigungen
- Datenschutz
- Einstellungen
- Hilfe
- Abmelden

Do not overload the dropdown with every preference.

## Full settings sections

### Profile

- display name;
- avatar;
- optional personal details actually needed by the product.

### Account

- email;
- password/security actions;
- account status;
- account deletion/export flows later as required.

### People & Groups

- households/groups the user belongs to;
- invitations;
- member management where the user has permission;
- clear separation between membership and data sharing.

### Notifications

- reminder preferences;
- suggestion notifications;
- travel/household/organization notification categories;
- future automation notifications.

### Privacy

- sharing overview;
- visibility defaults where applicable;
- connected app/integration permissions later;
- clear explanation that Connections do not change access rights.

### App preferences

Potential preferences:

- language;
- timezone;
- currency defaults;
- theme/appearance;
- accessibility preferences;
- reduced motion where supported.

## Logout

Logout must be easy to find and visually separated from destructive account actions.

## Daten herunterladen (DSGVO Art. 15/20, seit 15.11.2026)

Einstellungen → Profil, Karte „Deine Daten herunterladen“ zwischen Profilformular und „Konto löschen“. Ein Klick lädt
eine ZIP-Datei `4inone-daten-JJJJ-MM-TT.zip` (`GET /api/v1/auth/export/`, App `backend/datenexport/`).

- **Inhalt:** `LIESMICH.txt` (Erklärung und Anzahl der Einträge), `konto.json`, `finanzen.json`, `haushalt.json`,
  `organisation.json`, `reisen.json`, `verknuepfungen.json`, Ordner `dateien/` mit allen hochgeladenen Dateien.
- **Grenze wie in der App:** alles Eigene plus der Inhalt gemeinsamer Bereiche, in denen man Mitglied ist (Haushalt,
  Reisen); alte Haushaltsfinanzen nur für den eigenen Haushalt. Auch weich gelöschte Transaktionen (Feld `deleted_at`).
- **Nie enthalten:** Passwort-Hash, MFA-Schlüssel und Ersatzcodes, Token und Sitzungskennungen, das Einkommen anderer
  Haushaltsmitglieder, Inhalte privater Kalender anderer. Andere Personen nur mit Anzeigenamen, man selbst als „Du“.
- **Schutz:** angemeldet inkl. Zwei-Faktor, höchstens `RATE_LIMIT_DATA_EXPORT` Exporte pro Minute (Standard 2, gleiches
  Limit wie Finanzberichte), `Cache-Control: no-store`. Zu oft → „Bitte warte eine Minute“.
- **Neue Datenmodelle:** `datenexport/tests.py › test_every_model_is_exported_or_excluded_on_purpose` wird rot, bis ein
  neues Modell exportiert oder in `EXCLUDED_MODELS` (mit Grund) eingetragen ist.
- Nicht in der Demo (dort gibt es kein Profil).
