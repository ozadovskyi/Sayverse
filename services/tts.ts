import * as Speech from 'expo-speech';

import { e2eTts, IS_E2E } from './e2e';

/**
 * Text-to-speech, behind a provider interface so the engine can be swapped
 * later (e.g. a cloud neural voice) without touching callers.
 */
export interface TtsProvider {
  /**
   * Speak `text` in `languageCode` (BCP-47, e.g. `es`, `ru`). Resolves when
   * playback finishes, is stopped, or fails — speech is best-effort and the
   * promise never rejects, so a TTS failure does not fail the whole turn.
   */
  speak(text: string, languageCode: string): Promise<void>;
  /** Stop any in-progress speech. */
  stop(): void;
}

/** On-device TTS via `expo-speech` — free, offline, no API key. */
const expoSpeechTts: TtsProvider = {
  speak(text, languageCode) {
    return new Promise<void>(resolve => {
      Speech.speak(text, {
        language: languageCode,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  },
  stop() {
    void Speech.stop();
  },
};

/**
 * The TTS provider the app uses. E2E runs swap in a no-op provider so the
 * voice flow does not wait on (or depend on) real speech playback.
 */
export const tts: TtsProvider = IS_E2E ? e2eTts : expoSpeechTts;
