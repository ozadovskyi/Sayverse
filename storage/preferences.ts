import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * User preferences, persisted in AsyncStorage (localStorage-backed on web).
 * One getter/setter per preference — the set is small and rarely changes.
 */

const SPEAK_ALOUD_KEY = 'pref_speak_aloud';
const HIDE_ORIGINAL_KEY = 'pref_hide_original';

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

/**
 * Whether the source-language half of each conversation turn is hidden,
 * leaving only the translated half on screen. Defaults to `false` — keeping
 * both sides is the discoverable starting state; the user opts in once they
 * realise they want a less cluttered translated-only thread (typical for
 * live face-to-face use). Quick translate is unaffected — there the source
 * is the user's own typed / spoken input and hiding it makes no sense.
 */
export async function loadHideOriginal(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(HIDE_ORIGINAL_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function saveHideOriginal(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(HIDE_ORIGINAL_KEY, value ? 'true' : 'false');
  } catch {
    /* Storage unavailable — the preference just won't persist. */
  }
}
