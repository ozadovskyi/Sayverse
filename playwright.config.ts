import { defineConfig } from '@playwright/test';

const PORT = 8765;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Web E2E layer. Playwright drives the Expo web build (`react-native-web`),
 * which renders `testID` as `data-testid`. The voice path has no microphone
 * on web — that path is covered by the Maestro native layer; here the
 * typed-text translation path is exercised instead.
 */
export default defineConfig({
  testDir: './tests/web',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    testIdAttribute: 'data-testid',
    viewport: { width: 414, height: 896 },
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    // Build the web bundle, then serve it statically — deterministic in CI.
    command: 'npm run build:web && node scripts/serve-web.mjs',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
