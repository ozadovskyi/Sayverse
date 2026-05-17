import type { Transcription } from './openai';
import type { TtsProvider } from './tts';

/**
 * End-to-end test seam — the single place the Maestro layer reaches into.
 *
 * A simulator/emulator has no microphone to speak into and no real OpenAI
 * credentials, so the native E2E layer cannot drive the genuine voice
 * pipeline (record → Whisper → GPT → TTS). Rather than scatter `if (test)`
 * branches through the service code, every external dependency that pipeline
 * touches is funnelled through this one module: when `EXPO_PUBLIC_E2E` is
 * set, `audio.ts`, `openai.ts` and `tts.ts` each delegate to the fixtures
 * below instead of the real implementation.
 *
 * The result is a voice flow that is offline, free, and identical on every
 * run — so a Maestro flow can assert on known transcript and translation
 * text. Translation *quality* is covered separately by the `llm-eval` layer,
 * and Whisper accuracy is a documented v2 item (synthetic-audio fixtures);
 * this seam exists only to exercise the native UI wiring of the voice flow.
 *
 * `EXPO_PUBLIC_` is the Expo convention for vars inlined into the JS bundle.
 * It is set only by the `e2e` EAS build profile (see `eas.json`); production
 * builds leave it unset, so `IS_E2E` is `false` and no fixture code runs.
 */
export const IS_E2E: boolean = process.env.EXPO_PUBLIC_E2E === '1';

/**
 * Canned Whisper result. The language is Spanish so conversation-mode
 * auto-detect routes deterministically (es → the other paired language).
 */
export const E2E_TRANSCRIPTION: Transcription = {
  text: 'Hola, ¿dónde está la estación de tren?',
  language: 'spanish',
};

/**
 * Canned GPT translation. A fixed string (independent of input) so Maestro
 * flows can assert the exact text rendered after the pipeline completes.
 */
export const E2E_TRANSLATION = 'Привет, где находится железнодорожная станция?';

/** Canned language-detection result for typed-text auto-routing. */
export const E2E_DETECTED_LANGUAGE = 'es';

/** Placeholder URI standing in for a real recording file. */
export const E2E_RECORDING_URI = 'e2e://fixture-recording.m4a';

/** TTS provider for E2E runs — resolves instantly and plays nothing. */
export const e2eTts: TtsProvider = {
  speak() {
    return Promise.resolve();
  },
  stop() {},
};
