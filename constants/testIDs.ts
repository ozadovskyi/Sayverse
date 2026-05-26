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

  /**
   * Third-party-AI consent gate — shown once after the API key is saved
   * (Apple Guideline 5.1.2(i), GDPR Art 6(1)(a)). Resettable via Settings.
   */
  consent: {
    screen: 'consent-screen',
    agreeButton: 'consent-agree-button',
    declineButton: 'consent-decline-button',
    policyLink: 'consent-policy-link',
  },

  /** Top bar of the main translator screen. */
  header: {
    settingsButton: 'header-settings-button',
  },

  /** Source/target language selection. */
  language: {
    sourceButton: 'language-source-button',
    targetButton: 'language-target-button',
    swapButton: 'language-swap-button',
    cancelButton: 'language-cancel-button',
    modalBackdrop: 'language-modal-backdrop',
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
    speakButton: 'translation-speak-button',
  },

  /**
   * Typed-text translation path. The field and Go button only mount in
   * `typed` input mode; `toggleToTyped` (in voice mode) and `toggleToVoice`
   * (in typed mode) swap between the two.
   */
  textInput: {
    field: 'text-input-field',
    translateButton: 'text-input-translate-button',
    toggleToTyped: 'input-mode-toggle-typed',
    toggleToVoice: 'input-mode-toggle-voice',
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
    statusText: 'conversation-status-text',
    errorText: 'conversation-error-text',
    newSessionButton: 'conversation-new-session-button',
    historyModal: 'conversation-history-modal',
    historyEmpty: 'conversation-history-empty',
    /** A single dialogue turn — keyed by the turn's stable id, not index. */
    turn: (id: string) => `conversation-turn-${id}`,
    /** Tap-to-replay TTS button on a turn — keyed by turn id. */
    speakTurn: (id: string) => `conversation-speak-${id}`,
    /** A row in the History browser — keyed by the session's stable id. */
    session: (id: string) => `conversation-session-${id}`,
    sessionDeleteButton: (id: string) => `conversation-session-delete-${id}`,
    retryButton: 'conversation-retry-button',
  },

  /** Settings modal. */
  settings: {
    screen: 'settings-screen',
    closeButton: 'settings-close-button',
    logoutButton: 'settings-logout-button',
    speakAloudToggle: 'settings-speak-aloud-toggle',
    hideOriginalToggle: 'settings-hide-original-toggle',
    privacyPolicyButton: 'settings-privacy-policy-button',
    resetConsentButton: 'settings-reset-consent-button',
  },

  /** Connectivity banner. */
  offlineBanner: 'offline-banner',

  /** Shared copy-options sheet (original / translation / both). */
  copy: {
    sheet: 'copy-sheet',
    backdrop: 'copy-backdrop',
    /** Trigger button — keyed so single-shot card and per-turn buttons are addressable. */
    trigger: (key: string) => `copy-trigger-${key}`,
    original: 'copy-option-original',
    translation: 'copy-option-translation',
    both: 'copy-option-both',
  },

  /** Unified history (single-shot + conversation). */
  history: {
    /** Trigger button — present in both single and conversation modes. */
    button: 'history-button',
    singleEntry: (id: string) => `history-single-${id}`,
    singleEntryDeleteButton: (id: string) => `history-single-delete-${id}`,
  },
} as const);
