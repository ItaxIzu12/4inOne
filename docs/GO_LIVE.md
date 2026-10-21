# Go-Live-Checkliste (Stand 20.10.2026)

Was technisch vorbereitet ist und was vor dem Livegang noch **von dir** kommen muss.

## Muss vor dem Livegang erledigt sein

1. **Impressum, Datenschutzerklärung, Nutzungsbedingungen** — derzeit Platzhalter (`frontend/src/app/features/
   impressum|datenschutz|nutzungsbedingungen`). Impressum mit Name, Anschrift, E-Mail (§ 5 DDG). Die
   Datenschutzerklärung muss u. a. nennen:
   - Konto und Anmeldung (E-Mail, Name, Passwort-Hash, Sitzungen, Zwei-Faktor),
   - die Inhalte in Finanzen, Haushalt, Organisation, Reisen und hochgeladene Dateien,
   - **Besucherzählung**: nur Tageszähler je öffentlicher Seite und Gerätegröße (Handy/Computer), keine Cookies, keine
     IP-Adresse, keine Kennung; „Do Not Track“/„Global Privacy Control“ werden beachtet; Löschung nach
     `PAGEVIEW_RETENTION_DAYS` (Standard 730 Tage),
   - technisch notwendige Cookies (`refresh_token`, `csrftoken`) und die eine Browser-Einstellung im Einkaufsmodus.
   Danach den Platzhalter-Hinweis in `shared/legal-page/legal-page.html` entfernen.
2. **Domain eintragen:** `cd frontend && npm run seo -- https://deine-domain.de` — erzeugt `sitemap.xml`, ergänzt
   `robots.txt` und setzt die vollen Adressen für das Teilen-Bild.
3. **Server-Umgebung** (`.env`, siehe `.env.example`; `manage.py check --deploy` muss ohne Fehler laufen):
   `DEBUG=False`, eigener `SECRET_KEY`, `ALLOWED_HOSTS`, `DATABASE_URL` (PostgreSQL), `EMAIL_HOST`/… (echter
   Mailserver), `RATE_LIMIT_CACHE=database` + einmal `manage.py createcachetable`,
   `PRIVATE_MEDIA_ROOT` auf ein gesichertes Volume, `ADMIN_URL_PATH` auf einen eigenen Wert, `BEHIND_PROXY=True`
   nur hinter genau einem vertrauenswürdigen Proxy.
4. **Täglicher Cron-Job:** `python manage.py prune_website` (löscht abgelaufene Zähler der Besucherzählung).
5. **Webserver:** `index.html` für alle App-Adressen ausliefern (Single-Page-App), `/api/` an Django. Unbekannte
   Adressen zeigen die 404-Seite mit `noindex`; wer den echten HTTP-Status 404 möchte, braucht serverseitiges Rendern
   oder eine Liste bekannter Pfade im Webserver.

## Bereits erledigt

- Kein Cookie-Banner nötig: nur technisch notwendige Cookies, Schrift selbst gehostet, kein Tracking von Dritten.
- Seitentitel und Meta-Beschreibung je öffentlicher Seite, Teilen-Bild (Open Graph / Twitter), Favicon,
  Apple-Touch-Icon, Manifest-Icons, `robots.txt`, 404-Seite. Ein Kontaktformular gibt es bewusst nicht (entfernt 21.10.2026); Kontaktweg ist die E-Mail im Impressum.
- Sicherheits-Updates: Django 6.1.1, PyJWT 2.15.0; `pip-audit` und `npm audit` ohne Befund.

## Besucherzahlen ansehen

Im Django-Admin unter „Öffentliche Website › Seitenaufrufe“ (Filter nach Seite, Gerät, Tag).
