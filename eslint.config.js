// Flat ESLint config (ESLint 9). Two jobs beyond what `tsc` already covers:
// the Expo preset (unused vars, React-hooks rules, import correctness) and the
// Tailwind plugin, which validates every NativeWind `className` against
// `tailwind.config.js` — a non-existent class (e.g. a typo'd colour token) is
// a hard error rather than silently dropped at runtime.
const expoConfig = require('eslint-config-expo/flat');
const tailwind = require('eslint-plugin-tailwindcss');

module.exports = [
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'node_modules/*',
      'assets/icon-src/*', // standalone Node tooling, not part of the app
    ],
  },
  ...expoConfig,
  ...tailwind.configs['flat/recommended'],
  {
    settings: {
      tailwindcss: {
        config: 'tailwind.config.js',
      },
    },
    rules: {
      // Correctness rules — these catch the class of bug this config exists for.
      'tailwindcss/no-custom-classname': 'error',
      'tailwindcss/no-contradicting-classname': 'error',
      // Stylistic rules — off, to keep the diff about correctness, not churn.
      'tailwindcss/classnames-order': 'off',
      'tailwindcss/enforces-shorthand': 'off',
      // Redundant with `tsc` and less precise than it — the import plugin
      // can't trace members of native-module namespace objects (e.g.
      // `AudioModule.AudioRecorder`) that TypeScript resolves fine.
      'import/namespace': 'off',
    },
  },
  {
    // Jest mock factories are hoisted above the ESM imports, so they cannot
    // reference imported bindings — they must `require()` lazily. That is the
    // idiomatic pattern, not a smell, in test setup.
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
