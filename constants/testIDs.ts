/**
 * Single source of truth for `testID` values.
 *
 * Every interactive or assertable element references an id from here — never
 * an inline string literal. Both test layers consume this registry: Jest /
 * React Native Testing Library via `getByTestId`, and Playwright via
 * `[data-testid]` (react-native-web renders `testID` as `data-testid`).
 *
 * Conventions:
 * - kebab-case, feature-prefixed, semantic (describe the element's role).
 * - No index-based ids. Dynamic list items use a stable key (a language
 *   code, a turn id) via the helper functions below.
 *
 * The object is deep-frozen so a stray test cannot mutate an id at runtime.
 */

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.values(obj).forEach(deepFreeze);
    Object.freeze(obj);
  }
  return obj;
}

export const testIDs = deepFreeze({
  /** First-run screen: entering the OpenAI API key. */
  setup: {
    screen: 'setup-screen',
    apiKeyInput: 'setup-api-key-input',
    saveButton: 'setup-save-button',
  },

  /** Top bar of the main translator screen. */
  header: {
    settingsButton: 'header-settings-button',
    changeKeyButton: 'header-change-key-button',
  },

  /** Source/target language selection. */
  language: {
    sourceButton: 'language-source-button',
    targetButton: 'language-target-button',
    swapButton: 'language-swap-button',
    /** An option inside the picker — keyed by language code, not index. */
    option: (code: string) => `language-option-${code}`,
  },

  /** The single-shot translation result. */
  translation: {
    card: 'translation-card',
    originalText: 'translation-original-text',
    translatedText: 'translation-translated-text',
    errorText: 'translation-error-text',
    retryButton: 'translation-retry-button',
  },

  /** Typed-text translation path (works on web and native). */
  textInput: {
    field: 'text-input-field',
    translateButton: 'text-input-translate-button',
  },

  /** Voice recording control. */
  record: {
    button: 'record-button',
  },

  /** Single-shot vs conversation mode switch. */
  mode: {
    toggle: 'mode-toggle',
    singleShot: 'mode-single-shot',
    conversation: 'mode-conversation',
  },

  /** Bilingual conversation mode. */
  conversation: {
    view: 'conversation-view',
    thread: 'conversation-thread',
    newSessionButton: 'conversation-new-session-button',
    historyButton: 'conversation-history-button',
    /** A single dialogue turn — keyed by the turn's stable id, not index. */
    turn: (id: string) => `conversation-turn-${id}`,
  },

  /** Settings modal. */
  settings: {
    screen: 'settings-screen',
    closeButton: 'settings-close-button',
    logoutButton: 'settings-logout-button',
  },

  /** Connectivity banner. */
  offlineBanner: 'offline-banner',
} as const);
