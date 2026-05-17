import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * User preferences, persisted in AsyncStorage (localStorage-backed on web).
 * One getter/setter per preference — the set is small and rarely changes.
 */

const SPEAK_ALOUD_KEY = 'pref_speak_aloud';

/**
 * Whether translated text is read aloud in conversation mode. Defaults to
 * `false` — speech is opt-in, so a fresh install stays silent until the
 * user turns it on in Settings.
 */
export async function loadSpeakAloud(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SPEAK_ALOUD_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function saveSpeakAloud(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SPEAK_ALOUD_KEY, value ? 'true' : 'false');
  } catch {
    // Storage unavailable — the preference just won't persist.
  }
}
