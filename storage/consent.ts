import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Consent to send voice and text to OpenAI for transcription and translation.
 * Required by Apple App Store Guideline 5.1.2(i) (Nov 2025 third-party-AI
 * disclosure) and is the GDPR Article 6(1)(a) lawful basis on which Sayverse
 * operates the device→OpenAI flow.
 *
 * Versioned key — bumping the suffix forces re-consent on the next launch,
 * which is the documented way to handle a material privacy-policy change.
 */
const CONSENT_KEY = 'consent_openai_v1';

export async function loadConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function saveConsent(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, value ? 'true' : 'false');
  } catch {
    /* Storage unavailable — the consent just won't persist; the gate will re-ask next launch. */
  }
}

export async function clearConsent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CONSENT_KEY);
  } catch {
    /* Storage unavailable — the consent just won't persist. */
  }
}
