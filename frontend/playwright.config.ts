import { defineConfig } from '@playwright/test';

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
});
