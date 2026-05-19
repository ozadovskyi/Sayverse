# Trade-offs

Notable decisions and what each one cost.

## BYOK, no backend

The user enters their own OpenAI key; calls go device → OpenAI directly.

- **Gain** — no server to run, no key custody, no per-user billing, no privacy
  surface beyond OpenAI itself.
- **Cost** — onboarding friction (the user needs an OpenAI account), and the
  key lives on the device (mitigated: SecureStore on native).

## Jest + RNTL for unit and component tests

The unit and component layers run on Jest (`jest-expo`); the component layer
uses React Native Testing Library (RNTL).

- **Gain** — the recognised test setup for a React Native app: `jest-expo` is
  the Expo-maintained preset and RNTL is the standard component-test library,
  rendering the same component tree the device does. One runner spans
  pure-logic units, component rendering and the LLM eval — no second toolchain.
- **Cost** — the component layer renders in Node, not a real engine, so it
  cannot catch genuine-runtime issues (async timing, native layout). Those are
  the job of the Maestro native layer and the manual device pass. See
  [test-strategy.md](./test-strategy.md).

## Maestro for native E2E, not Detox

- **Gain** — low upkeep. Maestro is a standalone CLI with declarative YAML
  flows; no native build wiring, no test code compiled into the app, one flow
  runs on both iOS and Android.
- **Cost** — less programmatic control than Detox's JS API; Maestro cannot
  intercept network requests (handled below).

## In-app test seam, not a mock server

Maestro cannot intercept network calls, so a deterministic native E2E run needs
either a mock server (WireMock and similar) or an in-app seam.

- **Gain** — the audio path *must* be seamed in-app regardless (no mock server
  can give a simulator a microphone), so routing the network fixtures through
  the same `EXPO_PUBLIC_E2E` seam keeps it **one mechanism, not two**, and adds
  no CI infrastructure.
- **Cost** — fixture code is compiled into the `e2e` build (behind the flag);
  the seam is real code that must be kept correct. A unit test guards that the
  flag is off by default.

## Whisper transcription accuracy deferred to v2

The LLM-eval suite scores translation quality but not speech-to-text accuracy.

- **Gain** — v1 ships without curating a golden-audio corpus, which is a
  disproportionate effort for the first release.
- **Cost** — STT accuracy is not numerically tracked yet. Partly mitigated: the
  voice path is still exercised end to end by the Maestro layer. A v2 layer
  (synthetic-audio fixtures) is planned.

## Dark-only, single visual identity

The light theme and the theme switcher were dropped.

- **Gain** — one strong, bespoke look instead of a vague toggle; less surface
  to design, build and test.
- **Cost** — no light mode for users who want it.

## Skia on web

The neon edge-line is drawn with Skia, which runs on web via CanvasKit/WASM.

- **Gain** — one animation implementation; no separate web fallback to build.
- **Cost** — a heavier web bundle. The edge-line is decorative, so it degrades
  gracefully if the app is exported to web.
