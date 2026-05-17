import { Platform } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';

/**
 * Mono variant of the high-quality preset. Mono is sufficient for speech
 * transcription and roughly halves the upload payload sent to Whisper.
 */
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
};

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

/**
 * Request microphone permissions.
 * Returns true if granted.
 */
export async function requestPermissions(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
  return granted;
}

/**
 * Start recording audio.
 * Uses a mono high-quality preset for reliable transcription.
 */
export async function startRecording(): Promise<void> {
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

  recorder = new AudioModule.AudioRecorder(flattenForPlatform(RECORDING_OPTIONS));
  await recorder.prepareToRecordAsync();
  recorder.record();
}

/**
 * Stop recording and return the file URI.
 */
export async function stopRecording(): Promise<string | null> {
  if (!recorder) return null;

  await recorder.stop();
  await setAudioModeAsync({ allowsRecording: false });

  const uri = recorder.uri;
  recorder.release();
  recorder = null;
  return uri;
}

/**
 * Check if currently recording.
 */
export function isRecording(): boolean {
  return recorder?.isRecording ?? false;
}
