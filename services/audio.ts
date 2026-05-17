import { Audio } from 'expo-av';

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  web: {},
};

let recording: Audio.Recording | null = null;

/**
 * Request microphone permissions.
 * Returns true if granted.
 */
export async function requestPermissions(): Promise<boolean> {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
}

/**
 * Start recording audio.
 * Uses high-quality preset for better transcription.
 */
export async function startRecording(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording: rec } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  recording = rec;
}

/**
 * Stop recording and return the file URI.
 */
export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;

  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
  });

  const uri = recording.getURI();
  recording = null;
  return uri;
}

/**
 * Check if currently recording.
 */
export function isRecording(): boolean {
  return recording !== null;
}
