# Test strategy

OpenTranslator is tested in **three layers**, each with a crisp, non-overlapping
job. A test belongs to exactly one layer — the layer that can verify the thing
most cheaply and least flakily.

| Layer | Tool | Covers | Runs |
|---|---|---|---|
| Unit | Vitest (`unit` project) | Pure logic — reducers, helpers, service-level functions | Every PR |
| Web E2E | Playwright | Web UI flows — the typed-text translation path | Every PR |
| Native E2E | Maestro | The microphone voice path on a real simulator | Manual / weekly |

A fourth project, Vitest `llm-eval`, evaluates translation *quality* against the
live model — see [llm-evaluation.md](./llm-evaluation.md).

## Why these three, and why no Jest

The original plan had a fourth layer: Jest + React Native Testing Library for
isolated component tests. It was dropped on review.

- **Jest's unique contribution** over the other layers is *isolated component
  tests* — and that is precisely the slice that overlaps Playwright and Maestro,
  both of which already render and drive every component inside the real app.
  A layer whose justification is "it also does what two other layers do" is a
  weaker signal than three layers each with a distinct reason to exist.
- **A unit layer still exists** because pure logic genuinely cannot be covered
  by E2E: some state transitions are non-network (on-device TTS, recording,
  permission errors) so a network mock cannot observe them; E2E asserts on the
  rendered DOM, which is a *projection* of state, so a reducer-internal bug that
  does not visibly manifest slips through; and ~20 reducer transitions are cheap
  and flake-free as unit tests but slow and brittle as E2E.
- **Vitest, not Jest**, runs that unit layer. The logic under test is plain
  TypeScript with no component rendering, and Vitest was already in the stack
  for the LLM eval — one runner instead of two.

## Layer 1 — Unit (Vitest)

Plain-Node, deterministic, no UI and no network. The `conversationReducer` is
kept in its own React-free file precisely so it can be unit-tested in clean
Node. Coverage includes the conversation state machine
(`idle → recording → transcribing → translating → speaking`, plus `error`
reachable from every step), `findByCode` language normalisation, `classifyError`,
and the E2E-seam default guard.

```
npm test            # run once
npm run test:watch  # watch mode
```

## Layer 2 — Web E2E (Playwright)

Playwright drives the Expo **web** build (`react-native-web` renders `testID`
as `data-testid`). The OpenAI API is mocked with `page.route`, so the suite is
fast, free and deterministic — suitable for the PR gate. It covers the
typed-text translation path (happy + error), setup, the language picker,
settings, and the conversation-mode view. Page Object Models reference the
shared `testID` registry.

The voice path is **not** covered here — Expo web has no microphone.

```
npm run test:e2e
```

## Layer 3 — Native E2E (Maestro)

Maestro drives the genuine app on an iOS Simulator / Android emulator and
covers the one path the web layer structurally cannot: the **microphone voice
flow**. A simulator has no mic to speak into and no real credentials, so the
voice pipeline is routed through a single documented test seam — see
[architecture.md](./architecture.md#the-e2e-test-seam). With the seam the flow
is offline, free and deterministic, so flows assert on known transcript and
translation text.

```
npm run test:native   # needs a simulator + an `e2e`-profile build
```

## The testID registry

Every interactive or assertable element references an id from
`constants/testIDs.ts` — never an inline string. Ids are kebab-case,
feature-prefixed and semantic; dynamic list items are keyed by a stable value
(a language code, a turn id), never an index. The object is deep-frozen so a
stray test cannot mutate an id at runtime. Both the Playwright and Maestro
layers consume this single source of truth.

## CI

| Workflow | Trigger | Contents |
|---|---|---|
| `pr-checks.yml` | every PR + push to `main` | typecheck, Vitest `unit`, Playwright |
| `nightly-llm-eval.yml` | daily cron + manual | Vitest `llm-eval` (real API; `OPENAI_API_KEY` secret) |
| `native-tests.yml` | weekly cron + manual | Maestro on a macOS runner |

The PR gate is fast, free and secret-free. Real API spend lives only in the
nightly eval. The native layer needs a macOS runner so it runs off the PR path.
