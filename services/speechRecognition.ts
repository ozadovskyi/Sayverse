import { IS_E2E } from './e2e';

/**
 * On-device live transcription — a UI side-channel that runs in parallel with
 * the Whisper recording so the user sees their own words appearing as they
 * speak. The committed (translated) text still comes from Whisper after stop,
 * which keeps the existing hallucination silence-gate (`no_speech_prob` /
 * `avg_logprob`), Whisper-native language detection, and the translation
 * pipeline's quality. The partial transcript is purely UI — when Whisper
 * returns, its text replaces whatever SR had emitted, so a partial mis-spelling
 * never reaches the translation layer.
 *
 * Hybrid pattern matches what iTranslate Converse, Google Translate, and
 * Apple Translate ship: cloud-quality final text, on-device live preview.
 *
 * The provider is intentionally a tiny interface so callers can hand it a
 * lambda and forget about event-subscription bookkeeping.
 */
export interface SpeechRecognitionProvider {
  /**
   * Begin streaming partial transcripts in `languageCode` (BCP-47, e.g.
   * `en-US`, `es-ES`, `ru-RU`). `onPartial` receives the accumulated
   * transcript on every partial-result event. Resolves once SR is running
   * (or has decided not to run — permission denied, unsupported locale,
   * native module unavailable). Never throws — failures are swallowed so
   * the Whisper path is never blocked by the live-transcript add-on.
   */
  start(languageCode: string, onPartial: (transcript: string) => void): Promise<void>;
  /** Stop streaming. Idempotent. */
  stop(): void;
}

/**
 * Cache the resolved native module. `undefined` = not yet tried (lazy),
 * `null` = tried and unavailable (e.g. dev client hasn't been rebuilt yet
 * with the `expo-speech-recognition` plugin baked in). Once we know it's
 * unavailable, we skip the require so we don't spam the console.
 */
type NativeModuleRef = {
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  isRecognitionAvailable: () => boolean;
  addListener: (
    event: string,
    listener: (e: unknown) => void,
  ) => { remove: () => void };
  /**
   * iOS-only: reset the shared `AVAudioSession` category. By default
   * `expo-speech-recognition` leaves the session in `playAndRecord` +
   * `measurement` after a recording, which dampens subsequent
   * `expo-speech` TTS output to inaudibility on real devices. After we
   * stop, we explicitly flip the category back to `playback` so the
   * Speak-aloud setting and the tap-to-replay button work as expected.
   */
  setCategoryIOS?: (options: {
    category: string;
    categoryOptions: string[];
    mode?: string;
  }) => void;
};

let cachedModule: NativeModuleRef | null | undefined = undefined;

function loadModule(): NativeModuleRef | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // Dynamic require so a missing native module (dev client built before
    // the plugin was added) cannot crash the app at import time — the
    // Whisper path stays usable, the user just doesn't see live partial
    // transcripts until they rebuild.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition');
    cachedModule = mod.ExpoSpeechRecognitionModule as NativeModuleRef;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

/** Currently-attached `result` listener. One at a time — `stop()` clears it. */
let activeListener: { remove: () => void } | null = null;

const realProvider: SpeechRecognitionProvider = {
  async start(languageCode, onPartial) {
    const mod = loadModule();
    if (!mod) return;

    try {
      if (!mod.isRecognitionAvailable()) return;
    } catch {
      return;
    }

    try {
      const perm = await mod.requestPermissionsAsync();
      if (!perm.granted) return;
    } catch {
      return;
    }

    // Replace any prior listener so a stray double-start doesn't leak.
    activeListener?.remove();
    activeListener = mod.addListener('result', (event: unknown) => {
      const e = event as {
        results?: { transcript?: string }[];
      };
      const transcript = e.results?.[0]?.transcript ?? '';
      if (transcript) onPartial(transcript);
    });

    try {
      mod.start({
        // BCP-47 language tag — bare ISO 639-1 codes (`en`, `es`) also work
        // but a region-tagged tag (`en-US`, `es-ES`) gives the recognizer
        // better acoustic-model selection on iOS.
        lang: languageCode,
        interimResults: true,
        continuous: true,
        // `requiresOnDeviceRecognition: true` was tried first but crashed
        // on devices where the locale isn't installed on-device and
        // conflicted with `expo-audio`'s recording session. Letting iOS
        // decide cloud vs on-device per locale is more forgiving — privacy
        // costs nothing in our case since we don't store the partial.
      });
    } catch {
      activeListener?.remove();
      activeListener = null;
    }
  },
  stop() {
    activeListener?.remove();
    activeListener = null;
    const mod = loadModule();
    if (!mod) return;
    try {
      mod.stop();
    } catch {
      /* already stopped or never started — both safe. */
    }
    // Reset the shared audio session so subsequent TTS playback is audible.
    // The default SR start configures the session for `playAndRecord` +
    // `measurement`, which is correct for recording but mutes / heavily
    // attenuates `expo-speech` output afterwards. Flipping to `playback`
    // restores normal loudspeaker output for the Speak-aloud auto-read and
    // for the tap-to-replay buttons on each conversation turn.
    try {
      mod.setCategoryIOS?.({
        // `playback` is the canonical TTS-only category. `defaultToSpeaker`
        // was attempted here but it is only valid with `playAndRecord`
        // (Apple docs) — passing it with `playback` raised a native
        // exception that crashed the app on every speak / mic tap.
        // Plain `playback` routes through the loudspeaker when no
        // higher-priority output (headphones, BT) is active, which is
        // what we want.
        category: 'playback',
        categoryOptions: [],
        mode: 'default',
      });
    } catch {
      /* iOS-only API; on Android it's missing — safe to ignore. */
    }
  },
};

/** E2E build skips on-device speech recognition entirely. */
const e2eProvider: SpeechRecognitionProvider = {
  async start() {
    /* noop */
  },
  stop() {
    /* noop */
  },
};

export const speechRecognition: SpeechRecognitionProvider = IS_E2E
  ? e2eProvider
  : realProvider;

/**
 * Reset the shared iOS `AVAudioSession` to a playback-friendly category.
 * Call before `expo-speech` TTS so the loudspeaker plays at full volume
 * regardless of what the audio pipeline left behind:
 *  - `expo-audio` recording can leave the session in a `record`-only state
 *  - `expo-speech-recognition` defaults to `playAndRecord` + `measurement`
 *    which heavily attenuates TTS output on real devices
 *
 * Both legitimate `expo-speech-recognition`'s `setCategoryIOS` API and
 * silently no-ops if the module is unavailable (E2E build, dev client
 * not yet rebuilt with the SR plugin).
 */
export function resetAudioSessionForPlayback(): void {
  if (IS_E2E) return;
  const mod = loadModule();
  if (!mod?.setCategoryIOS) return;
  try {
    mod.setCategoryIOS({
      category: 'playback',
      categoryOptions: ['defaultToSpeaker'],
      mode: 'default',
    });
  } catch {
    /* iOS-only API; safe to ignore on platforms that lack it. */
  }
}
