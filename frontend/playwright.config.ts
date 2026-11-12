import { defineConfig, devices } from '@playwright/test';

/**
 * Browser-Tests (Backend simuliert, siehe e2e/helpers.ts).
 * - chromium: alle Tests.
 * - mobile-safari: WebKit mit iPhone-Maßen und Touch – die Seiten, die Freunde über den geteilten Link zuerst sehen
 *   (Startseite, Rechtsseiten, Demo mit allen vier Bereichen, Handy-Bedienung). WebKit ist die Engine von Safari;
 *   ein echtes iPhone ersetzt das nicht, fängt aber Safari-Eigenheiten früh ab.
 * Nur einen Browser: `npx playwright test --project=chromium`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  webServer: {
    command: 'npx ng serve --port 4210',
    url: 'http://localhost:4210',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:4210',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 15'] },
      testMatch: [
        'landing.spec.ts',
        'landing-journey.spec.ts',
        'public-pages.spec.ts',
        'demo-pages.spec.ts',
        'demo-dashboard.spec.ts',
        'connections-demo.spec.ts',
        'mobile-domain-controls.spec.ts',
        'accessibility.spec.ts',
      ],
    },
  ],
});
