// Global mocks for the component (RNTL) layer — registered before every
// component test file's modules load.
//
// What is mocked, and why:
//  - Native-rendering deps (reanimated, Skia, safe-area) — no renderer in a
//    Node test environment.
//  - The network / native-hardware service layer (openai, translation,
//    audio, tts, keyStorage) — the component layer exercises the assembled
//    UI and its wiring, not the real OpenAI SDK or the microphone.
// What is NOT mocked (kept real, on the in-memory AsyncStorage mock):
//  - storage/preferences and storage/conversationStorage — so persistence is
//    genuinely exercised (toggle survives a remount, history restores).

// ── Native-rendering deps ──────────────────────────────────────────────────

// react-native-reanimated v4's official mock loads the real worklets runtime,
// which has no native part in a Node test. A hand-rolled stub covers the small
// API surface the components use (RecordButton, TranslationCard) — animation
// is not asserted on, so the stubs collapse every animation to its end value.
jest.mock('react-native-reanimated', () => {
  const { Text, View } = require('react-native');
  const passthrough = (value: unknown) => value;
  return {
    __esModule: true,
    // `Animated.Text` and `Animated.View` are used as render targets for
    // `useAnimatedStyle` — render them as the plain RN equivalents so the
    // tree contains the same elements without trying to evaluate worklets.
    default: { View, Text },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useDerivedValue: (worklet: () => unknown) => ({ value: worklet() }),
    useAnimatedStyle: () => ({}),
    useAnimatedReaction: () => {},
    interpolateColor: (_v: unknown, _range: unknown, output: string[]) =>
      output[0],
    withTiming: passthrough,
    withRepeat: passthrough,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    cancelAnimation: () => {},
    Easing: new Proxy({}, { get: () => () => undefined }),
  };
});

// EdgeTrail is a decorative Skia canvas. Nothing is asserted on it, and Skia
// has no renderer in a Node test environment — render it as nothing.
jest.mock('../../../components/EdgeTrail', () => ({
  __esModule: true,
  default: () => null,
}));

// safe-area-context's real SafeAreaProvider renders nothing until onLayout
// fires — which never happens in the test renderer. Its official mock
// supplies static insets so children render immediately. The mock file
// default-exports the module object, hence `.default`.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// AsyncStorage — the official in-memory Jest mock. preferences and
// conversation history are persisted through it for real.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// ── Service layer ──────────────────────────────────────────────────────────

// The network-status hook wraps a native module — default every component
// test to "online". The mock is a `jest.fn` so an offline test can flip the
// return value via `mockOffline()` in render.tsx.
jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(() => ({ isOffline: false })),
}));

jest.mock('../../../services/openai', () => ({
  initOpenAI: jest.fn(),
  transcribeAudio: jest.fn(async () => ({ text: '', language: '' })),
  translateText: jest.fn(async () => ''),
  detectLanguage: jest.fn(async () => 'es'),
}));

jest.mock('../../../services/translation', () => ({
  transcribeForTranslation: jest.fn(async () => ({ text: '', detectedCode: 'es' })),
}));

jest.mock('../../../services/audio', () => ({
  requestPermissions: jest.fn(async () => true),
  startRecording: jest.fn(async () => undefined),
  stopRecording: jest.fn(async () => null),
}));

jest.mock('../../../services/tts', () => ({
  tts: { speak: jest.fn(async () => undefined), stop: jest.fn() },
}));

jest.mock('../../../services/keyStorage', () => ({
  // Signed out by default — a test wanting the translator screen calls
  // `mockSignedIn()` (see support/render.tsx).
  getApiKey: jest.fn(async () => null),
  setApiKey: jest.fn(async () => undefined),
  clearApiKey: jest.fn(async () => undefined),
}));
