import { defineConfig, devices } from '@playwright/test';

/**
 * Full-Stack-Tests: echte Oberfläche (ng serve, Port 4210) gegen echtes Django (Port 8000) – nichts simuliert.
 * Eigene, frische SQLite-Datenbank unter test-results/ (nie backend/db.sqlite3), lokaler Testserver mit DEBUG=True,
 * nur auf localhost. Start: `npx playwright test -c playwright.fullstack.config.ts`.
 */
const DB = `${process.cwd()}/test-results/fullstack.sqlite3`;
const backendEnv = [
  'DEBUG=True',
  'SECRET_KEY=fullstack-test-only',
  'ALLOWED_HOSTS=localhost,127.0.0.1',
  'CORS_ALLOWED_ORIGINS=http://localhost:4210',
  'FRONTEND_URL=http://localhost:4210',
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
      command: `mkdir -p test-results && rm -f "${DB}" && cd ../backend && env ${backendEnv} ${python} manage.py migrate --noinput && env ${backendEnv} ${python} manage.py runserver 127.0.0.1:8000 --noreload`,
      url: 'http://127.0.0.1:8000/api/v1/auth/csrf/',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npx ng serve --port 4210',
      url: 'http://localhost:4210',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
  use: { baseURL: 'http://localhost:4210', ...devices['Desktop Chrome'] },
});
