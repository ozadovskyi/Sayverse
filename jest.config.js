/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Jest owns unit + component tests (co-located `*.test.ts(x)` / `__tests__`).
  // The other test layers have their own runners and must NOT be collected
  // here: Playwright (`tests/web`), Maestro (`tests/native`), Vitest LLM-eval
  // (`tests/llm-eval`).
  testPathIgnorePatterns: ['/node_modules/', '/tests/', '/dist/'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.config.{js,ts}',
  ],
};
