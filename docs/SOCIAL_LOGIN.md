# Anmeldung mit Google und Apple (seit 19.11.2026)

„Weiter mit Google“ und „Weiter mit Apple“ auf Anmelden und Konto erstellen. Ein Anbieter erscheint **nur**, wenn
seine Zugangsdaten in `backend/.env` stehen — ohne Werte gibt es weder Knopf noch Endpunkt.

## Einrichten

### Google (kostenlos, lokal testbar)

1. <https://console.cloud.google.com> › Projekt anlegen › **APIs & Dienste › OAuth-Zustimmungsbildschirm**:
   Typ „Extern“, App-Name „Lumiknot“, Support-E-Mail, Bereiche `openid`, `email`, `profile`. Solange die App im
   Testmodus ist, eigene Google-Konten unter „Testnutzer“ eintragen.
2. **Anmeldedaten › OAuth-Client-ID erstellen**, Typ „Webanwendung“. Autorisierte Weiterleitungs-URI:
   - lokal: `http://localhost:8000/api/v1/auth/oauth/google/callback/`
   - Server: `https://<deine-domain>/api/v1/auth/oauth/google/callback/`
3. In `backend/.env`: `GOOGLE_OAUTH_CLIENT_ID=…`, `GOOGLE_OAUTH_CLIENT_SECRET=…`, `OAUTH_CALLBACK_BASE=http://localhost:8000`
   (auf dem Server die öffentliche HTTPS-Adresse). Django neu starten.

### Apple (Apple Developer Program, 99 $/Jahr, nur mit HTTPS-Domain)

1. <https://developer.apple.com/account> › **Identifiers**: eine App ID mit „Sign in with Apple“, dann eine
   **Services ID** (z. B. `de.4inone.web`) → „Sign in with Apple“ konfigurieren: Domain und Return URL
   `https://<deine-domain>/api/v1/auth/oauth/apple/callback/`. Apple akzeptiert **kein** `localhost` und kein `http`.
2. **Keys** › neuen Schlüssel mit „Sign in with Apple“ → `.p8`-Datei **einmalig** herunterladen, Key ID notieren.
   Team ID steht oben rechts im Konto.
3. `.p8` auf dem Server **außerhalb des Repositorys** ablegen (z. B. `/srv/4inone-secrets/AuthKey_XXXX.p8`, Rechte
   600; `*.p8` steht zusätzlich in `.gitignore`).
4. In `backend/.env`: `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH`.

`docker-compose.yml` braucht dafür **keine** Änderung — die Anmeldung läuft im bestehenden Django-Backend.

## Ablauf

```
Knopf → GET /api/v1/auth/oauth/<anbieter>/start/          state + nonce + PKCE-Verifier signiert im Cookie (10 Min.)
      → Anbieter (Konto wählen, zustimmen)
      → Rückruf …/callback/ (Google GET, Apple POST)      state prüfen → Code + Verifier gegen ID-Token tauschen
                                                           → ID-Token prüfen (Signatur/JWKS, iss, aud, exp, nonce)
      → Frontend /login?social=…
           ok           bekannter Zugang → angemeldet
           neu          neues Konto (E-Mail bestätigt, kein Passwort) → Onboarding
           verknuepfen  E-Mail gehört schon einem Konto → einmal dessen Passwort (+ Zwei-Faktor) eingeben
           zwei-faktor  Konto hat Zwei-Faktor → Code eingeben
      → /login?fehler=…  abgebrochen · abgelaufen · email · token · anbieter · gesperrt (nie Details)
```

## Sicherheitsentscheidungen

- **Verknüpft wird über die feste Kennung des Anbieters (`sub`), nie über die E-Mail.** Gibt es schon ein Konto mit
  der E-Mail, wird erst nach Eingabe **seines Passworts** verknüpft (Entscheidung 19.11.2026) — niemand übernimmt ein
  Konto nur über eine E-Mail-Adresse. Nur vom Anbieter bestätigte E-Mails werden angenommen.
- **Zwei-Faktor gilt immer.** Ohne Code keine Sitzung; Sitzungen über Google/Apple ohne Code zählen nicht als
  Zwei-Faktor-Sitzung (Admin-Panel bleibt zu).
- **Login-CSRF:** `state` ist an ein signiertes, httpOnly-Cookie dieses Browsers gebunden (zeitkonstanter Vergleich).
  **Code-Abfangen:** PKCE (S256). **Wiedereinspielen:** `nonce`. **Fälschung:** nur RS256 mit den öffentlichen
  Schlüsseln des Anbieters.
- Offene Schritte (verknüpfen, Zwei-Faktor) liegen signiert, 10 Minuten gültig im Cookie — nie in der Adresse.
  Weiterleitungen nur zu `FRONTEND_URL`. Apple-Rückruf: Ablauf-Cookie mit `SameSite=None; Secure` (Apples POST).
- Rate-Limits: Start/Rückruf `RATE_LIMIT_SOCIAL_LOGIN` (20/min/IP), Passwort beim Verknüpfen wie die Anmeldung
  (5/min + axes), Zwei-Faktor wie bisher.
- Konten ohne Passwort (nur Google/Apple) können über „Passwort vergessen“ eines festlegen. Konto löschen entfernt
  die Verknüpfungen; der DSGVO-Export enthält sie (`konto.json › verknuepfte_anmeldungen`).
- An Lumiknot gehen nur Name und E-Mail; der Hinweis steht unter den Formularen. In der **Datenschutzerklärung** Google
  und Apple als Anmeldewege nennen (GO_LIVE.md).

## Tests

`backend/core/test_social.py` (27): ganzer Ablauf mit selbst signierten ID-Token, sieben Fälschungsarten plus
`alg: none`, falscher/fehlender `state`, manipulierte Cookies, Verknüpfen nur mit Passwort (+ Zwei-Faktor), Konflikt,
Zwei-Faktor nach Google, Apple-Client-Secret (ES256) und Formular-Rückruf, gleichzeitige Rückrufe, ungültige Code-
Eingaben. Gegenproben: ohne `state`-Prüfung und mit automatischer Verknüpfung schlagen die Tests fehl.
Frontend: `features/login/login.spec.ts`, `e2e/auth-social.spec.ts` (alle Rückkehr-Zustände, axe WCAG 2.2 AA).
