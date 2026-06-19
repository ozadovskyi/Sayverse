// Runs after the test framework is installed — where the `jest` global (and
// `jest.setTimeout`) exists.
//
// Each component test FILE boots the full App module graph plus the
// babel-preset-expo transform lazily on its first render. On a slow/loaded CI
// runner that cold start exceeds Jest's default 5s per-test timeout and flakes
// (the same render finishes in ~2s locally and never reproduces). 15s headroom:
// findBy resolves the instant an element appears, so warm tests pay nothing —
// only the ceiling for a cold first render moves.
//
// NB: `testTimeout` is a global-only Jest option; inside `projects[]` it is
// silently ignored (emits a Validation Warning), so the bump must be applied
// here at runtime rather than in the project config.
jest.setTimeout(15000);
