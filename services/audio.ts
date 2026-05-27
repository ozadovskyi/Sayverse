import { Platform } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';

import { E2E_RECORDING_URI, IS_E2E } from './e2e';

/**
 * Mono variant of the high-quality preset, with metering on so the recorder
 * can publish input-level updates to the silence-detection hook (see
 * {@link useSilenceDetection}). Mono is sufficient for speech transcription
 * and roughly halves the upload payload sent to Whisper.
 */
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  isMeteringEnabled: true,
};

/** How often the recorder polls its own metering to publish level updates. */
const LEVEL_POLL_MS = 100;

/**
 * expo-audio's `AudioRecorder` expects options already flattened for the
 * current platform — the `useAudioRecorder` hook does this internally via a
 * non-exported helper. This service is imperative (not hook-based), so the
 * same flattening is reproduced here.
 */
function flattenForPlatform(options: RecordingOptions) {
  const common = {
    extension: options.extension,
    sampleRate: options.sampleRate,
    numberOfChannels: options.numberOfChannels,
    bitRate: options.bitRate,
    isMeteringEnabled: options.isMeteringEnabled ?? false,
  };
  if (Platform.OS === 'ios') return { ...common, ...options.ios };
  if (Platform.OS === 'android') return { ...common, ...options.android };
  return { ...common, ...options.web };
}

let recorder: AudioRecorder | null = null;
let levelPollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Request microphone permissions.
 * Returns true if granted.
 */
export async function requestPermissions(): Promise<boolean> {
  // E2E: no real mic, so no permission to grant — report success.
  if (IS_E2E) return true;
  const { granted } = await requestRecordingPermissionsAsync();
  return granted;
}

/**
 * Start recording audio.
 *
 * `onLevel` (optional) receives the current input level in dBFS every
 * ~100 ms, until `stopRecording()` is called. Used to drive on-device
 * silence detection (`useSilenceDetection`) and the live level indicator
 * on the record button. Range is roughly -160 (silence) to 0 (clipping);
 * conversational speech indoors sits around -35 to -20.
 */
export async function startRecording(
  onLevel?: (db: number) => void,
): Promise<void> {
  // E2E: nothing to capture — the fixture URI is produced on stop.
  if (IS_E2E) return;

  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

  const r = new AudioModule.AudioRecorder(flattenForPlatform(RECORDING_OPTIONS));
  recorder = r;
  await r.prepareToRecordAsync();
  r.record();

  if (onLevel) {
    levelPollTimer = setInterval(() => {
      // `metering` reads -160 dBFS until the first frame is captured. Skip
      // those readings so the silence-detection hook does not see a fake
      // "silence" event at startup before the recorder has any audio yet.
      const status = r.getStatus();
      const db = status.metering;
      if (typeof db === 'number' && Number.isFinite(db) && db > -150) {
        onLevel(db);
      }
    }, LEVEL_POLL_MS);
  }
}

/**
 * Stop recording and return the file URI.
 */
export async function stopRecording(): Promise<string | null> {
  // E2E: hand back a placeholder URI; `transcribeAudio` is also seamed and
  // never reads it.
  if (IS_E2E) return E2E_RECORDING_URI;

  if (levelPollTimer) {
    clearInterval(levelPollTimer);
    levelPollTimer = null;
  }
  if (!recorder) return null;

  await recorder.stop();
  await setAudioModeAsync({ allowsRecording: false });

  const uri = recorder.uri;
  recorder.release();
  recorder = null;
  return uri;
}
