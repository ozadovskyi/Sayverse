import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Unit layer — pure logic only (reducers, helpers, service-layer
        // functions). Fast, deterministic, no UI and no network, so it runs
        // in the PR gate. Component rendering is covered by the Playwright
        // (web) and Maestro (native) layers, not here.
        test: {
          name: 'unit',
          environment: 'node',
          include: ['**/*.test.ts'],
          // `tests/` is reserved for the other layers — Playwright (web),
          // Maestro (native), and the Vitest `llm-eval` project — each of
          // which has its own runner/project.
          exclude: ['**/node_modules/**', '**/dist/**', 'tests/**'],
        },
      },
      // The `llm-eval` project (real OpenAI API, cron only) is added in
      // Phase E.
    ],
  },
});
