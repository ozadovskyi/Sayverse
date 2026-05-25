# Architecture

Sayverse is an Expo / React Native app. There is **no backend** — it is
bring-your-own-key (BYOK): the user's OpenAI key is entered on-device and every
API call goes straight from the device to OpenAI.

## Stack

- **Expo SDK 55**, React Native 0.83, React 19, TypeScript 5.9 (strict).
- **UI** — NativeWind v4 (Tailwind utility classes for RN), `react-native-reanimated`
  (animation), `@shopify/react-native-skia` (the neon glow / edge-line).
- **APIs** — OpenAI GPT-4o-mini (translation), Whisper (transcription).
- **On-device** — `expo-audio` (recording), `expo-speech` (text-to-speech).
- **Persistence** — `AsyncStorage` (conversation history), `expo-secure-store`
  on native / `localStorage` on web (the API key).

## Layout

```
App.tsx              Root — API-key setup screen, then the translator screen
components/          UI — RecordButton, LanguagePicker, TranslationCard,
                     OfflineBanner, SettingsScreen, ConversationView,
                     ConversationHistory, BottomSheet, EdgeTrail
constants/           languages, testIDs, theme palette, conversation types
hooks/               useConversation, conversationReducer, useNetworkStatus
services/            audio, openai, errors, tts, keyStorage, e2e
storage/             conversationStorage (AsyncStorage sessions)
tests/               component/ (Jest + RNTL), native/ (Maestro), llm-eval/ (Jest)
```

## Two translation modes

- **Single-shot** — type or speak one phrase, get one translation. This is the
  app's original flow; it lives in `App.tsx` as a `useState`-based component
  and was deliberately left as-is.
- **Conversation** — bilingual turn-taking with persisted session history. The
  spoken language is auto-detected (from Whisper's `verbose_json` output) and
  routed: speak language A, hear language B, and vice versa.

## The conversation state machine

Conversation mode is built as an **impure shell around a pure core**:

- `hooks/conversationReducer.ts` — a pure reducer. State is
  `idle → recording → transcribing → translating → speaking`, with `error`
  reachable from every step. No React, no I/O — kept in its own file precisely
  so it can be unit-tested in clean Node.
- `hooks/useConversation.ts` — the impure shell. It runs the async pipeline
  (record → Whisper → translate → TTS) and dispatches the pure transitions.

This split is why the state machine is covered cheaply by unit tests while the
full pipeline is covered by the E2E layers.

## Service layer

Each external concern is a small module behind a narrow interface, so it can be
swapped without touching callers:

- `openai.ts` — `transcribeAudio` (returns `{ text, language }`), `translateText`,
  `detectLanguage` (single-shot auto-detect routing).
- `audio.ts` — imperative recording on `expo-audio`.
- `tts.ts` — text-to-speech behind a `TtsProvider` interface (`expo-speech`
  today; a cloud neural voice could be dropped in later).
- `errors.ts` — `classifyError` maps raw failures to a typed `AppError` with a
  user-facing message and a `retryable` flag; `withRetry` backs the API calls.
- `keyStorage.ts` — platform-aware key storage (SecureStore / `localStorage`).

## The E2E test seam

`services/e2e.ts` is the single seam the Maestro native layer reaches through.
A simulator has no microphone and no real credentials, so when the
`EXPO_PUBLIC_E2E` flag is set (only by the `e2e` EAS build profile) the three
services that the voice pipeline touches — `audio`, `openai`, `tts` — each
delegate, in one guarded line, to deterministic fixtures defined in `e2e.ts`.

The seam is funnelled through one module on purpose: not scattered `if (test)`
branches, and `IS_E2E` is `false` unless the flag is explicitly set — a unit
test guards that default so a production build can never ship fixture data.

## Design

Dark-only "Tron / neon" identity — neon cyan on near-black, thin glowing
strokes, monospace technical type. The signature element is `EdgeTrail`, a
Skia-drawn glowing line that runs the screen perimeter and changes colour /
speed with app state (idle / recording / processing). The palette is defined
once in `tailwind.config.js`, with JS-side values in `constants/theme.ts` for
Skia. Skia is native-primary; on web the edge-line degrades gracefully.
