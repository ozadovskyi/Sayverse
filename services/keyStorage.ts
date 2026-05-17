import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Storage for the user's OpenAI API key.
 *
 * `expo-secure-store` has no web backend (its native module is an empty
 * object on web, so every call throws). On web the key is kept in
 * `localStorage` instead — not encrypted, but a BYOK web app inherently
 * trusts the browser it runs in. Native platforms keep the encrypted
 * SecureStore.
 */

const KEY = 'openai_api_key';
const isWeb = Platform.OS === 'web';

export async function getApiKey(): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY);
}

export async function setApiKey(value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(KEY, value);
    } catch {
      /* storage unavailable (private mode, etc.) — key just won't persist */
    }
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

export async function clearApiKey(): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      /* nothing to clean up */
    }
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
