import { defineConfig } from '@playwright/test';

const CI = Boolean(process.env.CI);
const PORT = 5181;

// Locally the tests drive the installed Microsoft Edge (no browser download);
// CI installs Playwright's Chromium. Both are Chromium-based.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: CI ? 2 : 4,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/polis-css-metropolis/`,
    viewport: { width: 1440, height: 900 },
    ...(CI ? {} : { channel: 'msedge' }),
  },
  projects: [{ name: CI ? 'chromium' : 'msedge', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node tools/serve.js --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/polis-css-metropolis/`,
    reuseExistingServer: !CI,
  },
});
