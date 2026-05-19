// Jest is the single test runner. Three projects, each a distinct layer:
//
//   unit       — pure logic (reducers, helpers, service-layer functions).
//   component  — React Native Testing Library: real components rendered on
//                the native tree, driven through the assembled app.
//   llm-eval   — translation quality against the live OpenAI API.
//
// `unit` + `component` are fast, deterministic and secret-free — they run in
// the PR gate (`npm test`). `llm-eval` costs money and is non-deterministic,
// so it runs on manual dispatch only (`npm run eval`).
//
// `jest-expo` is the platform preset (it wires babel-preset-expo, the RN
// module mocks and the asset transform); `jest-expo/node` is its plain-Node
// variant for the eval suite, which renders nothing.

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/+(constants|hooks|services|storage)/**/*.test.ts'],
    },
    {
      displayName: 'component',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/tests/component/**/*.test.tsx'],
      setupFiles: ['<rootDir>/tests/component/support/setup.ts'],
      // Clear call history between tests; the mock implementations baked into
      // setup.ts survive (mockClear, not mockReset), and each test re-arranges
      // its own scenario via the support/render.tsx helpers.
      clearMocks: true,
      moduleNameMapper: {
        // App.tsx imports the NativeWind stylesheet — irrelevant to a Node
        // render, and not a module Jest can resolve.
        '\\.css$': '<rootDir>/tests/component/support/css-mock.js',
      },
    },
    {
      displayName: 'llm-eval',
      preset: 'jest-expo/node',
      testMatch: ['<rootDir>/tests/llm-eval/**/*.eval.ts'],
      // The setup file initialises the app's OpenAI client. The `eval` npm
      // script supplies `--runInBand` (so suites don't hit the API rate
      // limit) and `--testTimeout` (real network calls are slow).
      setupFiles: ['<rootDir>/tests/llm-eval/support/setup.ts'],
    },
  ],
};
