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
      {
        // LLM-eval layer — exercises the app's real `translateText` against
        // the live OpenAI API and scores the output (embeddings, language
        // detection, LLM-as-judge). Non-deterministic and costs money, so it
        // is NOT in the PR gate — it runs on cron / manual dispatch only.
        // `npm run eval` runs just this project.
        test: {
          name: 'llm-eval',
          environment: 'node',
          include: ['tests/llm-eval/**/*.eval.ts'],
          setupFiles: ['./tests/llm-eval/support/setup.ts'],
          // Real network calls are slow; give each generous headroom.
          testTimeout: 45_000,
          // Run files serially so concurrent suites don't hammer the API
          // rate limit (and to keep cost/log output legible).
          fileParallelism: false,
        },
      },
    ],
  },
});
