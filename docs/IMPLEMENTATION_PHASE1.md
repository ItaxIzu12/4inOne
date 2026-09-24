# Umsetzung: Authentifizierung, Dashboard und Onboarding

Stand: 24. September 2026.

## Oberfläche

Bestehendes Angular-/Django-Projekt weiterverwendet; keine Versions-Upgrades.
`AppShell` bündelt Desktop-Navigation, Topbar, Suche nach Bereichen, Kontomenü
und mobile Navigation. `Brand` und `AppIcon` werden in Shell, Dashboard,
Authentifizierung und Onboarding wiederverwendet. Der vorhandene `Modal`
übernimmt Fokusführung und Escape-Verhalten. `Dashboard` zeigt explizit
gekennzeichnete Beispieldaten mit anklickbaren Tages-, Verbindungs- und
Packlistenansichten. Die Packlisten-Vorschau bleibt nur im Speicher.
`AreaPreview` stellt die vorbereiteten Ziele Reisen und Familie bereit.
Bestehende Fachmodule wurden nicht neu implementiert oder entfernt.

## Authentifizierung

Bestehende Django-Benutzer, Passwort-Hashing und JWT-Implementierung bleiben.
Refresh-Token liegt im HttpOnly-/SameSite-Strict-Cookie (Secure in Produktion),
Access-Token nur im Arbeitsspeicher. Ergänzt: CSRF-Token-Abfrage und expliziter
CSRF-Schutz bei Login, Registrierung, Refresh und Logout; Passwortwiederholung,
Vorname und Zustimmung werden serverseitig validiert. Zwei-Faktor-Challenges
werden vom Frontend behandelt, bevor es eine Sitzung übernimmt.
Widerrufene Refresh-Token liefern 401 statt eines Serverfehlers. Abgelaufene
Access-Token werden beim Cookie-Refresh nicht als Authorization-Header gesendet.
Registrierung bleibt ein Formular ohne Haushaltsfragen. Der bestehende private
Einpersonen-Haushalt wird aus Kompatibilitätsgründen weiterhin angelegt.

## Onboarding

Route: `/app/onboarding`, ausschließlich angemeldet. Vier Schritte:
Willkommen → Nutzungsart → Bereiche → Zusammenfassung und Abschluss.
Der Dashboard-Guard prüft den aktuellen Status beim Öffnen der Startseite.
Auch ein direkter Aufruf der Einführung prüft den Status erneut.

Die Einführung erscheint, wenn sie nicht abgeschlossen ist und keine eigenen
Nutzdaten vorliegen. Geprüft werden eigene Transaktionen, feste Abzüge,
Einkommensangaben, Aufgaben/Zuweisungen/Erledigungen, Einkaufsartikel und
abgeschlossene Einkäufe, Ordnereinträge sowie Kalendereinträge. In persönlichen
Einpersonen-Haushalten zählen auch ältere Daten ohne Autor, eigene Kategorien,
Budgetziele und Rücklagen. Automatisch angelegte Kategorien und ein leerer
Haushalt zählen nicht. Daten anderer Personen unterdrücken die Einführung
nicht allein durch gemeinsame Mitgliedschaft. Reise-Datenmodelle existieren
noch nicht; diese Prüfung muss bei deren Einführung ergänzt werden.

Abschluss und Auswahl liegen pro Benutzer in `OnboardingProfile`.
Abgeschlossene Konten sehen die Einführung auch nach erneutem Login nicht wieder.
Bei Ladefehlern wird eine Wiederholung angeboten, kein leerer Account angenommen.
Eine abgebrochene, noch nicht gespeicherte Einführung beginnt erneut bei Schritt 1.
Die Auswahl gemeinsamer Nutzung erzeugt weder Einladungen noch Freigaben.
Die Bereichsauswahl speichert Interessen; alle Bereiche bleiben zugänglich.

## Datenbank und API

- Neues Modell: `core.OnboardingProfile` (User, Nutzungsart, Bereiche, Abschlusszeit).
- Migration: `core/0006_onboardingprofile.py`, lokal angewendet.
- Neu: `GET /api/v1/auth/csrf/`.
- Neu: `GET /api/v1/onboarding/profile/` und `PUT /api/v1/onboarding/profile/`.
- Bestehender `GET /api/v1/onboarding/status/` bleibt kompatibel bestehen.
- Registrierung verlangt zusätzlich `name`, `confirm_password` und `accept_privacy`.
- Cookie-basierte Auth-Schreibzugriffe verlangen einen CSRF-Nachweis.

## Prüfung

- 212 Backend-Tests bestanden.
- 124 Frontend-Tests bestanden.
- 19 Browserprüfungen bestanden (inklusive axe/WCAG und responsive Ansichten).
- Produktionsbuild erfolgreich.
- Django-Systemcheck erfolgreich, keine ausstehenden Modelländerungen.
- Onboarding-Mobil- und Desktop-Screenshots visuell geprüft.
- Browser-Onboardingtests simulieren API-Antworten; die reale API und
  Datenisolation werden separat in Django-Tests geprüft.

## Verbleibende Grenzen

Die bereits vorhandene Warnung für `finanzen.scss` bleibt: 16,69 kB bei
12 kB Warnlimit. Der bestehende Passwort-Reset erzeugt noch keine echte E-Mail;
die Versand-Anbindung bleibt offen. Die vorhandenen Fachmodule verwenden
weiterhin ihr bisheriges Haushaltsmodell; eine vollständige Migration auf
persönliche Eigentümerschaft und ausdrückliche Freigaben ist nicht Teil dieser
UI-/Auth-Phase. Dashboard-Daten sind weiterhin als Vorschau gekennzeichnet.
Es wurden keine echte Connection Engine, Automatisierung oder neue
Fachmodullogik implementiert.

## Geänderte und neue Dateien

- `backend/config/settings.py`
- `backend/config/urls.py`
- `backend/core/auth_urls.py`
- `backend/core/auth_views.py`
- `backend/core/migrations/0006_onboardingprofile.py`
- `backend/core/models.py`
- `backend/core/onboarding_views.py`
- `backend/core/test_auth.py`
- `backend/core/test_auth_phase1.py`
- `backend/core/test_mfa.py`
- `backend/core/test_onboarding.py`
- `docs/IMPLEMENTATION_PHASE1.md`
- `frontend/e2e/onboarding.spec.ts`
- `frontend/e2e/phase1.spec.ts`
- `frontend/public/favicon.svg`
- `frontend/public/manifest.webmanifest`
- `frontend/src/app/app.routes.ts`
- `frontend/src/app/app.spec.ts`
- `frontend/src/app/app.ts`
- `frontend/src/app/core/auth/auth.interceptor.ts`
- `frontend/src/app/core/auth/auth.service.spec.ts`
- `frontend/src/app/core/auth/auth.service.ts`
- `frontend/src/app/core/onboarding/onboarding-api.service.ts`
- `frontend/src/app/core/onboarding/onboarding.guard.ts`
- `frontend/src/app/features/area-preview/area-preview.ts`
- `frontend/src/app/features/dashboard/dashboard.html`
- `frontend/src/app/features/dashboard/dashboard.scss`
- `frontend/src/app/features/dashboard/dashboard.spec.ts`
- `frontend/src/app/features/dashboard/dashboard.ts`
- `frontend/src/app/features/finanzen/finanzen-state.service.spec.ts`
- `frontend/src/app/features/login/login.html`
- `frontend/src/app/features/login/login.scss`
- `frontend/src/app/features/login/login.spec.ts`
- `frontend/src/app/features/login/login.ts`
- `frontend/src/app/features/onboarding/onboarding-page.html`
- `frontend/src/app/features/onboarding/onboarding-page.scss`
- `frontend/src/app/features/onboarding/onboarding-page.spec.ts`
- `frontend/src/app/features/onboarding/onboarding-page.ts`
- `frontend/src/app/layout/app-shell.html`
- `frontend/src/app/layout/app-shell.scss`
- `frontend/src/app/layout/app-shell.ts`
- `frontend/src/app/shared/brand/brand.ts`
- `frontend/src/app/shared/icons/app-icon.ts`
- `frontend/src/index.html`
