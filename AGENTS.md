# AGENTS.md

A pointer file for AI coding agents working in this repository. Humans should
read [`README.md`](./README.md) and the design notes in [`docs/`](./docs/).

## What this project is

OpenTranslator is a React Native / Expo SDK 55 voice + text translator. It uses
OpenAI Whisper for transcription and GPT-4o-mini for translation. The OpenAI
API key is **bring-your-own** — entered on-device and never leaves it — so the
app has no backend.

Two modes:
- **Single-shot** (`Quick translate`) — type or speak a phrase, get the
  translation back, with TTS playback.
- **Conversation** — bilingual turn-taking, auto-detects which of the two
  picker languages was spoken, translates to the other, reads it aloud, and
  persists the dialogue.

## Stack

- Expo SDK 55, React Native 0.83, React 19, TypeScript strict
- NativeWind v4, `react-native-reanimated`, `@shopify/react-native-skia`
  (dark "Tron / neon" UI, animated `EdgeTrail`)
- `expo-audio` (recording), `expo-speech` (TTS), `expo-speech-recognition`
  (on-device live transcript while user speaks)
- Jest (`jest-expo`) with three projects: `unit`, `component`, `llm-eval`
- Maestro for native voice-path E2E

## Commands

```bash
npm test                  # Jest unit + component projects (the PR gate)
npm run test:watch        # Jest unit + component, watch mode
npm run test:native       # Maestro native E2E (needs an emulator + e2e build)
npm run eval              # Jest llm-eval project (real OpenAI API; needs OPENAI_API_KEY)
npm run typecheck         # tsc --noEmit
npm run lint              # eslint + NativeWind class validation
npm run deadcode          # knip — dead-code / unused-export audit

# Native build (dev client — Expo Go is not enough, native modules are used)
npx expo run:ios          # or `run:android`
```

## Project structure

- `App.tsx` — single-shot mode + the top-level layout. Conversation mode is
  driven by `hooks/useConversation.ts` + `hooks/conversationReducer.ts`.
- `components/` — UI components (NativeWind classes; testIDs from
  `constants/testIDs.ts`).
- `services/` — pure modules: `openai.ts` (API client + `transcribeAudio` /
  `translateText`), `transcription.ts` (Whisper hallucination gate),
  `translation.ts` (shared transcribe-for-translate pipeline),
  `speechRecognition.ts` (on-device SR wrapper), `tts.ts`, `audio.ts`,
  `errors.ts` (`classifyError` + `withRetry`), `e2e.ts` (the test seam).
- `storage/` — AsyncStorage persistence (conversation sessions, single-shot
  history, preferences).
- `constants/` — languages, themes, testIDs, conversation types.
- `tests/component/` — RNTL component tests; mock service modules at the
  module boundary, run real `storage/*` on in-memory AsyncStorage.
- `tests/llm-eval/` — LLM evaluation suite; calls the real OpenAI API on
  manual workflow dispatch only.
- `docs/` — `architecture.md`, `test-strategy.md`, `llm-evaluation.md`,
  `tradeoffs.md`, device-test findings, the v1.1 UX plan.

## Conventions

- **testIDs** are centralised in `constants/testIDs.ts` — never hard-code a
  string in a `testID` prop or test. Component tests use these via
  `getByTestId`.
- **Pure logic in `services/`** stays Node-runnable (no React, no RN) so the
  `unit` Jest project can exercise it without rendering. The reducer in
  `hooks/conversationReducer.ts` is the same: pure, exported, unit-tested.
- **Streaming translation**: `translateTextStreaming` (in `services/openai.ts`)
  is the default path; the non-streaming `translateText` is kept for the
  LLM-eval suite where determinism matters more than perceived latency.
- **Whisper language hint**: single-shot mode passes the picker's source
  language to `transcribeAudio` (kills cross-language hallucination on short
  clips). Conversation mode deliberately omits the hint — it needs
  auto-detect to route the turn between the two picker languages.
- **Repetition gate**: `isRepetitive` in `services/transcription.ts` catches
  Whisper repetition loops that the `no_speech_prob` / `avg_logprob` gate
  misses. Both modes use it.
- **E2E seam**: `IS_E2E` (from `services/e2e.ts`) swaps real services for
  fixture-returning ones during the Maestro run.

## Constraints

- **BYOK**: never introduce a server, a backend proxy, or any path where the
  user's OpenAI key leaves the device. The whole architecture rests on this.
- **No `expo-av`**: deprecated in SDK 54+, migrated out. Use `expo-audio`.
- **Dark-only theme**: there is no light variant; the `neonTron` palette is
  the single source of truth (Tailwind config).

## When running the LLM-eval suite

`npm run eval` (or the manual-dispatch `llm-eval.yml` workflow) calls the real
OpenAI API and incurs real cost. It is NOT part of the PR gate. The golden
dataset (`tests/llm-eval/data/golden-translations.json`) is Spain-life
EN↔ES / ES↔RU / ES↔UK pairs across five categories. Threshold calibration
is documented in the file header.

## Backlog

The active backlog is in [`docs/v1.1-ux-plan-2026-05-23.md`](./docs/v1.1-ux-plan-2026-05-23.md)
and the plan summary in [`docs/architecture.md`](./docs/architecture.md).
