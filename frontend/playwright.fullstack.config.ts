import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Full-Stack-Tests: echte Oberfläche (ng serve, Port 4211, Konfiguration „fullstack“) gegen echtes Django (Port 8010)
 * – nichts simuliert. Eigene Ports, damit ein lokal laufendes Lumiknot (8000/4200) weiterlaufen kann.
 * Eigene, frische SQLite-Datenbank im Temp-Ordner des Systems (nie backend/db.sqlite3), lokaler Testserver mit
 * DEBUG=True, nur auf localhost. Start: `npx playwright test -c playwright.fullstack.config.ts`.
 *
 * Die Datenbank liegt bewusst NICHT unter test-results/: Jeder Playwright-Lauf leert diesen Ordner beim Start. Lief
 * parallel ein zweiter Lauf (z. B. einzelne e2e-Specs), verschwand die Datenbank mitten im Test („unable to open
 * database file“, 28.11.2026).
 */
const DB = join(tmpdir(), 'lumiknot-fullstack-tests.sqlite3');
const backendEnv = [
  'DEBUG=True',
  'SECRET_KEY=fullstack-test-only',
  'ALLOWED_HOSTS=localhost,127.0.0.1',
  'CORS_ALLOWED_ORIGINS=http://localhost:4211',
  'FRONTEND_URL=http://localhost:4211',
  'OAUTH_CALLBACK_BASE=http://localhost:8010',
  `DATABASE_URL=sqlite:///${DB}`,
  'FX_FETCH_ENABLED=False',
  'RATE_LIMIT_REGISTER=100',
  'RATE_LIMIT_LOGIN=100',
].join(' ');
const python = process.env['PYTHON'] ?? '.venv/bin/python';

export default defineConfig({
  testDir: './e2e-fullstack',
  timeout: 60_000,
  workers: 1,
  webServer: [
    {
      command: `rm -f "${DB}" && cd ../backend && env ${backendEnv} ${python} manage.py migrate --noinput && env ${backendEnv} ${python} manage.py runserver 127.0.0.1:8010 --noreload`,
      url: 'http://127.0.0.1:8010/api/v1/auth/csrf/',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npx ng serve --configuration fullstack --port 4211',
      url: 'http://localhost:4211',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
  use: { baseURL: 'http://localhost:4211', ...devices['Desktop Chrome'] },
});
