# Test strategy

Sayverse is tested in **three layers**, each with a crisp, non-overlapping
job. A test belongs to exactly one layer — the layer that can verify the thing
most cheaply and least flakily.

| Layer | Tool | Covers | Runs |
|---|---|---|---|
| Unit | Jest (`unit` project) | Pure logic — reducers, helpers, service-level functions | Every PR |
| Component | Jest + React Native Testing Library (`component` project) | The React components, rendered on the native tree and driven through the assembled app | Every PR |
| Native E2E | Maestro | The microphone voice path on an emulator | Manual |

A fourth Jest project, `llm-eval`, evaluates translation *quality* against the
live model — see [llm-evaluation.md](./llm-evaluation.md).

## One runner — Jest

All three Jest projects run on **`jest-expo`**, the Expo-maintained preset. It is
the standard test setup for a React Native / Expo app: it wires `babel-preset-expo`,
the React Native module mocks and the asset transform. React Native Testing
Library (RNTL) — the standard component-test library for React Native — runs on
the same preset. One runner covers pure logic, component rendering and the LLM
eval, so there is no second toolchain to learn or maintain.

`jest.config.js` defines the three projects; `--selectProjects` runs one or
more. The PR gate runs `unit` + `component`; `llm-eval` is manual-dispatch only.

## Layer 1 — Unit (Jest `unit` project)

Plain-Node, deterministic, no UI and no network. The `conversationReducer` is
kept in its own React-free file precisely so it can be unit-tested in clean
Node. Coverage includes the conversation state machine
(`idle → recording → transcribing → translating → speaking`, plus `error`
reachable from every step), `findByCode` / `resolveDirection` language routing,
`classifyError`, `isSilentTranscription`, `pickLatestForPair`, conversation
storage parsing, and the E2E-seam default guard.

Some of this genuinely *cannot* be covered by the E2E layers: a few state
transitions are non-network (on-device TTS, recording, permission errors), so a
network mock cannot observe them; the higher layers assert on rendered output,
which is a *projection* of state, so a reducer-internal bug that does not
visibly manifest slips through; and the reducer's ~20 transitions are cheap and
flake-free as unit tests but slow and brittle as E2E.

```
npm test            # runs unit + component
npm run test:watch  # watch mode
```

## Layer 2 — Component (Jest + React Native Testing Library)

RNTL renders the **real components on the React Native tree** and drives the
fully-assembled `<App />` — entering an API key, typing a phrase, switching
modes, opening the language picker and settings, restoring conversation
history. It is the recognised component-test approach for React Native: fast,
free, deterministic, and running against the same component tree the device
renders — so it belongs in the PR gate.

What is faked, and what is not:

- **Faked — the service layer.** The network / native-hardware modules
  (`services/openai`, `services/translation`, `services/audio`, `services/tts`,
  `services/keyStorage`) are mocked at the module boundary. The component layer
  exercises the assembled UI and its wiring, not the OpenAI SDK or the
  microphone.
- **Real — persistence.** `storage/preferences` and `storage/conversationStorage`
  run for real on an in-memory AsyncStorage, so a preference surviving a remount
  and history restoring on re-entry are genuinely exercised.
- The decorative Skia `EdgeTrail` and `react-native-reanimated` are stubbed —
  animation is not asserted on, and neither has a renderer in Node.

These tests are integration-style by design: they drive the **assembled app**,
not isolated components in a vacuum. Isolated component tests would mostly
re-verify what driving the real app already covers — the value is in the wiring.

The voice path is **not** covered here — a Node render has no microphone. That
is the native layer's job.

```
npm test
```

## Layer 3 — Native E2E (Maestro)

Maestro drives the genuine app on an Android emulator and covers the one path
the component layer structurally cannot: the **microphone voice flow**. An
emulator has no mic to speak into and no real credentials, so the voice pipeline
is routed through a single documented test seam — see
[architecture.md](./architecture.md#the-e2e-test-seam). With the seam the flow
is offline, free and deterministic, so flows assert on known transcript and
translation text.

It also runs the key **interaction flows on the native layer** — the language
picker, the settings sheet, the typed-text path. The component layer covers
these in a Node render; running the same interactions on a real emulator is the
platform coverage (native `Modal`s, the navigation bar, gestures), not
duplication.

```
npm run test:native   # needs an emulator + an `e2e`-profile build
```

## The testID registry

Every interactive or assertable element references an id from
`constants/testIDs.ts` — never an inline string. Ids are kebab-case,
feature-prefixed and semantic; dynamic list items are keyed by a stable value
(a language code, a turn id), never an index. The object is deep-frozen so a
stray test cannot mutate an id at runtime. Both the component layer (RNTL's
`getByTestId`) and the Maestro layer consume this single source of truth.

## CI

| Workflow | Trigger | Contents |
|---|---|---|
| `pr-checks.yml` | every PR + push to `main` | lint + dead-code, typecheck, Jest `unit` + `component` |
| `llm-eval.yml` | manual dispatch | Jest `llm-eval` (real API; `OPENAI_API_KEY` secret) |
| `native-tests.yml` | manual dispatch | Maestro on an Android emulator (Linux runner) |

The PR gate is fast, free and secret-free — both gate layers run in Node, with
no browser and no emulator. Real API spend lives only in the LLM eval, which is
why it is manual-dispatch only — never scheduled. The native layer builds the
app and boots an emulator — far too slow for the PR path — so it is
manual-dispatch too.

## The manual device-test pass

The three automated layers are complemented by a deliberate **manual pass on a
real device** before each release. This is not a gap in the suite — it is a
layer, and current (2026) practice is explicit that manual and automated
testing are complementary: *discover manually, automate to protect*. Some bug
classes are simply not cost-effective to automate, and a real device exposes
issues an emulator and a Node render never will — keyboard behaviour, the system
navigation bar, gestures, OEM quirks, cold-start latency, and the overall
*feel* of an animation.

What the manual pass covers, and why it is not automated:

- **Native system-UI integration** — the keyboard not covering inputs, sheets
  clearing the navigation bar. Automatable in part, but asserting "not
  visually occluded" is unreliable (an occluded element is still "present").
- **Visual and animation feel** — the `EdgeTrail` speed and layering. "Too
  fast" is a human judgment; visual-regression tooling is deferred (see below).
- **Real Whisper behaviour** — transcription quality on genuine audio. Every
  automated layer seams or mocks Whisper; only real audio exercises it.

Release checklist (run on a real Android/iOS device, signed-in with a key):

1. All three bottom sheets — language picker, settings, history — open, and
   dismiss via their button **and** a backdrop tap; no control sits under the
   navigation bar.
2. Typed-text: the keyboard does not cover the input or the translate button.
3. Single-shot voice: record → translate → result; speak silence → "no speech"
   rather than a garbage result.
4. Conversation: a full turn with auto-detect routing; speak-aloud toggles and
   can be interrupted mid-playback; history restores after an app restart.
5. The `EdgeTrail` animates without overlapping controls.

**Deliberately not automated (deferred).** Visual-regression testing — in 2026,
AI-powered visual tools have matured, but the signature UI here is the animated
`EdgeTrail`, which is the documented weak case for screenshot testing, and it
would mean adopting a paid platform; deferred for v1. Whisper transcription
accuracy — needs a curated golden-audio corpus; a planned v2 eval category.
