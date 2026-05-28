import './global.css';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { ConversationSession } from './constants/conversation';
import {
  DEFAULT_SOURCE,
  DEFAULT_TARGET,
  findByCode,
  Language,
  resolveDirection,
} from './constants/languages';
import type { SingleShotEntry } from './constants/historyEntry';
import {
  HEADER_TOP_OFFSET,
  PILL_BOTTOM_OFFSET,
} from './constants/layout';
import { testIDs } from './constants/testIDs';
import { colors } from './constants/theme';
import {
  detectLanguage,
  initOpenAI,
  translateTextStreaming,
} from './services/openai';
import { transcribeForTranslation } from './services/translation';
import { AppError, AppErrorType, classifyError } from './services/errors';
import { requestPermissions, startRecording, stopRecording } from './services/audio';
import { speechRecognition } from './services/speechRecognition';
import { clearApiKey, getApiKey, setApiKey } from './services/keyStorage';
import { clearConsent, loadConsent, saveConsent } from './storage/consent';
import {
  loadHideOriginal,
  loadSpeakAloud,
  saveHideOriginal,
  saveSpeakAloud,
} from './storage/preferences';
import { appendSingleShot } from './storage/singleShotStorage';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useConversation } from './hooks/useConversation';
import type { ConversationStatus } from './hooks/conversationReducer';
import type { AutoStopReason } from './hooks/silenceDetection';
import { useSilenceDetection } from './hooks/useSilenceDetection';
import HistoryScreen from './components/HistoryScreen';
import ConversationView from './components/ConversationView';
import EdgeTrail, { type TrailState } from './components/EdgeTrail';
import {
  TrailHighlightProvider,
  useTrailHighlightOutlineStyle,
} from './contexts/TrailHighlight';
import LanguagePicker from './components/LanguagePicker';
import OfflineBanner from './components/OfflineBanner';
import PillButton from './components/PillButton';
import PrivacyConsent from './components/PrivacyConsent';
import RecordButton from './components/RecordButton';
import SettingsScreen from './components/SettingsScreen';
import TranslationCard from './components/TranslationCard';
import Animated from 'react-native-reanimated';

/** Reasonably-unique id for a single-shot history entry. */
function generateHistoryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type Mode = 'single' | 'conversation';
/**
 * Single-shot input mode. `voice` (default) shows the record button and a
 * `Type` toggle; `typed` shows the input field and a `Voice` toggle — only
 * one surface is on screen at a time, instead of competing for space.
 */
type InputMode = 'voice' | 'typed';

const CONVERSATION_STATUS_LABEL: Record<ConversationStatus, string> = {
  idle: 'Tap to speak the next turn',
  recording: 'Listening…',
  transcribing: 'Transcribing…',
  translating: 'Translating…',
  speaking: 'Speaking…',
  error: '',
};

const CONVERSATION_BUSY: ConversationStatus[] = [
  'transcribing',
  'translating',
  'speaking',
];

/** App title with the second half in neon — the Tron wordmark. */
function Wordmark({ size }: { size: 'lg' | 'sm' }) {
  const cls = size === 'lg' ? 'text-3xl' : 'text-xl';
  return (
    <Text className={`${cls} font-bold tracking-tight text-fg`}>
      Say<Text className="text-neon">verse</Text>
    </Text>
  );
}

/**
 * Quick translate vs conversation segmented control.
 *
 * Conversation is the default surface (see `mode` state initializer); Quick
 * Translate is the single-shot "translate this thing" affordance. The order
 * places Conversation first so the chip layout reads as "default, alternate"
 * rather than "primary, secondary". Research basis: every leading translator
 * app (Google, Apple, MS, DeepL, iTranslate) ships these as two distinct
 * surfaces — single-shot for "translate this sign / phrase" and conversation
 * for face-to-face turn-taking — and the 2025-2026 trend reinforces the
 * split. We mirror that here instead of merging the two.
 */
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const segment = (value: Mode, label: string, tid: string) => {
    const active = mode === value;
    return (
      <Pressable
        testID={tid}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => onChange(value)}
        className={`flex-1 items-center rounded-lg py-2 ${active ? 'bg-neon/15' : ''}`}
      >
        <Text
          className={`font-mono text-[11px] uppercase tracking-[2px] ${
            active ? 'text-neon' : 'text-fg-faint'
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View
      testID={testIDs.mode.toggle}
      className="mx-5 mt-2 flex-row rounded-xl border border-neon/20 bg-surface p-1"
    >
      {segment('conversation', 'Conversation', testIDs.mode.conversation)}
      {segment('single', 'Quick translate', testIDs.mode.singleShot)}
    </View>
  );
}

function AppContent() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  /**
   * Third-party-AI consent flag (Apple 5.1.2(i) / GDPR 6(1)(a)). `null` while
   * the AsyncStorage read is in flight — keep both setup and main screens
   * hidden during that brief window to avoid a flash of the wrong surface.
   */
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [speakAloud, setSpeakAloud] = useState(false);
  const [hideOriginal, setHideOriginal] = useState(false);

  // Conversation is the default surface — see ModeToggle for the rationale.
  // Quick translate is a deliberate switch the user opts into.
  const [mode, setMode] = useState<Mode>('conversation');
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [source, setSource] = useState<Language>(DEFAULT_SOURCE);
  const [target, setTarget] = useState<Language>(DEFAULT_TARGET);

  const [textInput, setTextInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [error, setError] = useState<AppError | null>(null);
  const [lastTranscription, setLastTranscription] = useState<{
    text: string;
    source: string;
    target: string;
    /**
     * BCP-47 code of the target language. Needed by the result card's
     * tap-to-speak button so it can hand the right voice to expo-speech,
     * which would otherwise fall back to the device locale and produce a
     * mismatch (e.g. read Spanish text in an English voice).
     */
    targetCode: string;
  } | null>(null);
  /**
   * The most recent recording's audio URI, held only while a retry of the
   * transcribe step is meaningful. When `transcribeForTranslation` succeeds we
   * clear it; if it fails (network drop between record-end and the Whisper
   * call), the URI stays so the Retry button can re-attempt transcription
   * without losing what the user dictated.
   */
  const [pendingAudioUri, setPendingAudioUri] = useState<string | null>(null);

  // Trail highlight for the `Go` button — the rectangular text-input
  // translate trigger. Its animated styles drive border + glow as the
  // comet sweeps over it. All other pill controls use the `PillButton`
  // component, whose hook lives inside the component so a conditional
  // unmount cleans up automatically; `Go`'s shape (rounded-xl, not a
  // full pill) needs custom styling so it stays inline here. Because
  // the visual is driven via plain RN style props, the hook can live
  // unconditionally in this parent without creating phantom rects — an
  // unmounted Animated.View just makes `measure()` return null next
  // tick and the glow stays at 0.
  const goHighlight = useTrailHighlightOutlineStyle('rgba(0,255,240,1)');

  const { isOffline } = useNetworkStatus();

  const conversation = useConversation(source.code, target.code, speakAloud);
  const {
    state: convState,
    liveTranslation: convLiveTranslation,
    liveTranscript: convLiveTranscript,
    beginRecording,
    endRecording,
    retryTurn,
    dismissError: dismissConvError,
    startNewSession,
    resumeOrStart,
    loadSession,
    stopSpeaking,
    level: convLevel,
    hasHeardSpeech: convHasHeardSpeech,
  } = conversation;

  useEffect(() => {
    getApiKey().then(saved => {
      if (saved) {
        initOpenAI(saved);
        setIsReady(true);
      }
    });
    loadConsent().then(setHasConsent);
  }, []);

  // Conversation is the default surface, so the most recent persisted chat
  // for the current language pair should be loaded as soon as the app boots
  // (matches the behaviour the user used to get only after switching modes).
  // Gated on `isReady` so we don't try to resume before the API key is in
  // place — `resumeOrStart` only reads storage, but launching it before the
  // setup screen has handed off would race with `handleSaveKey` and produce
  // a fresh session that overwrites the user's actual recent thread.
  useEffect(() => {
    if (isReady && mode === 'conversation') void resumeOrStart();
    // We deliberately exclude `mode`, `resumeOrStart` and the language
    // deps from this hook: it is the "boot into conversation default"
    // effect, fired once on launch, not a reactor for later state
    // changes. Including `resumeOrStart` would re-fire on every
    // language swap (the callback's identity depends on langA/langB),
    // pulling the saved session for the new pair into a "+New" canvas
    // the user just intentionally cleared — a real device-test bug.
    // Mode change is handled by `handleModeChange`; History
    // re-selection by `handleLoadSession`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  useEffect(() => {
    loadSpeakAloud().then(setSpeakAloud);
    loadHideOriginal().then(setHideOriginal);
  }, []);

  const handleToggleSpeakAloud = useCallback(() => {
    setSpeakAloud(prev => {
      const next = !prev;
      void saveSpeakAloud(next);
      return next;
    });
  }, []);

  const handleToggleHideOriginal = useCallback(() => {
    setHideOriginal(prev => {
      const next = !prev;
      void saveHideOriginal(next);
      return next;
    });
  }, []);

  const handleSaveKey = useCallback(async () => {
    const key = apiKeyInput.trim();
    if (!key.startsWith('sk-')) {
      Alert.alert('Invalid key', 'OpenAI API key should start with "sk-"');
      return;
    }
    await setApiKey(key);
    initOpenAI(key);
    setIsReady(true);
  }, [apiKeyInput]);

  const handleConsentAgree = useCallback(async () => {
    await saveConsent(true);
    setHasConsent(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await clearApiKey();
    setIsReady(false);
    setShowSettings(false);
    setApiKeyInput('');
    setTextInput('');
    setOriginalText('');
    setTranslatedText('');
    setError(null);
    setLastTranscription(null);
    setPendingAudioUri(null);
    setRecording(false);
    setProcessing(false);
    setInputMode('voice');
  }, []);

  /**
   * Decline at the consent gate. Now that the gate is front-loaded (it
   * appears before the API-key setup screen), there is no key or session
   * to tear down — Decline is a soft block: explain why the app cannot
   * proceed without consent and leave the user on the gate. iOS HIG
   * forbids programmatic exit, so the user's options are to come back
   * via Agree or to quit the app themselves; CCPA 2026 symmetry-of-choice
   * is satisfied by the Decline button existing and being equally
   * affordant to Agree, not by us forcing an action neither of us wants.
   */
  const handleConsentDecline = useCallback(() => {
    Alert.alert(
      'Consent required',
      'Sayverse cannot transcribe or translate without your consent. You can read the privacy policy from this screen, or close the app.',
      [{ text: 'OK' }],
      { cancelable: false },
    );
  }, []);

  /** Settings → Reset consent. Re-shows the gate on the next render. */
  const handleResetConsent = useCallback(async () => {
    await clearConsent();
    setHasConsent(false);
    setShowSettings(false);
  }, []);

  const handleSwapLanguages = useCallback(() => {
    setSource(target);
    setTarget(source);
  }, [source, target]);

  const handleModeChange = useCallback((next: Mode) => {
    setMode(next);
    // No automatic resumeOrStart on mode switch — the in-memory
    // conversation session survives the trip through single-shot mode,
    // so the user comes back to whichever session they had open
    // (whether resumed at launch, started fresh via +New, or selected
    // from History). Calling resumeOrStart here would re-pull the
    // newest saved session for the current language pair and
    // overwrite a History-loaded selection — a device-test bug.
  }, []);

  /** Block a network action when offline, with a consistent alert. */
  const guardOnline = useCallback(() => {
    if (isOffline) {
      Alert.alert('No connection', 'Internet is required for translation.');
      return false;
    }
    return true;
  }, [isOffline]);

  /**
   * Translate `text`, auto-routing the direction within the selected pair:
   * `detectedCode` (Whisper's for voice, a detection call's for typed) decides
   * which of the two picker languages is the source.
   */
  const runTranslation = useCallback(
    async (text: string, detectedCode: string | undefined) => {
      setError(null);
      setProcessing(true);
      setOriginalText(text);
      setTranslatedText('');
      const dir = resolveDirection(detectedCode, source.code, target.code);
      setLastTranscription({
        text,
        source: dir.sourceName,
        target: dir.targetName,
        targetCode: dir.targetLang,
      });
      try {
        // Streaming render: each delta from the OpenAI completion lands in
        // state immediately so the user sees the translation grow rather than
        // waiting on a single response. The returned value is the final
        // trimmed string and matches what the non-streaming variant returns,
        // so the history write below sees the same text the user sees.
        const translated = await translateTextStreaming(
          text,
          dir.sourceName,
          dir.targetName,
          setTranslatedText,
        );
        // Persist the successful single-shot so it surfaces in History. The
        // storage write is fire-and-forget; a failed write is non-fatal —
        // history is a convenience, not core state.
        void appendSingleShot({
          kind: 'single',
          id: generateHistoryId(),
          originalText: text,
          translatedText: translated,
          sourceLang: dir.sourceLang,
          targetLang: dir.targetLang,
          createdAt: Date.now(),
        });
      } catch (e: unknown) {
        setError(classifyError(e));
      } finally {
        setProcessing(false);
      }
    },
    [source, target],
  );

  /**
   * Re-open a single-shot entry in single mode. Restores the texts and the
   * direction labels so the Retry path and the copy menu read the same way
   * as after the original translation.
   */
  const handleSelectSingleShot = useCallback((entry: SingleShotEntry) => {
    setMode('single');
    setShowHistory(false);
    setError(null);
    setOriginalText(entry.originalText);
    setTranslatedText(entry.translatedText);
    setLastTranscription({
      text: entry.originalText,
      source: findByCode(entry.sourceLang)?.name ?? entry.sourceLang,
      target: findByCode(entry.targetLang)?.name ?? entry.targetLang,
      targetCode: entry.targetLang,
    });
    setPendingAudioUri(null);
  }, []);

  /**
   * Wrap conversation `loadSession` so selecting a conversation entry from
   * the unified history switches into conversation mode automatically.
   */
  const handleSelectSession = useCallback(
    (session: ConversationSession) => {
      setMode('conversation');
      setShowHistory(false);
      loadSession(session);
    },
    [loadSession],
  );

  const handleTranslateText = useCallback(async () => {
    const trimmed = textInput.trim();
    if (!trimmed || processing || recording) return;
    if (!guardOnline()) return;
    setError(null);
    setProcessing(true);
    try {
      // Typed text has no Whisper detection — ask for the language first.
      const detected = await detectLanguage(trimmed);
      // The text is committed now — clear the field so the next entry starts
      // fresh. `runTranslation` keeps it in `originalText` for the result card
      // and in `lastTranscription` for Retry, so nothing is lost.
      setTextInput('');
      // Hide the keyboard so the result is visible; the typed-mode UI stays
      // — tapping the field brings the keyboard back if the user wants more.
      Keyboard.dismiss();
      await runTranslation(trimmed, detected);
    } catch (e: unknown) {
      setError(classifyError(e));
      setProcessing(false);
    }
  }, [textInput, processing, recording, guardOnline, runTranslation]);

  /**
   * Stop the active recording and run the transcribe-and-translate
   * pipeline. Extracted from `handleRecordPress` so it can be called both
   * by a user tap and by the VAD auto-stop (trailing-silence or
   * max-duration); the no-speech VAD reason has its own faster teardown
   * that skips the pipeline (see `handleVoiceAutoStop`).
   */
  const stopRecordingAndTranscribe = useCallback(async () => {
    setRecording(false);
    setProcessing(true);
    setError(null);
    // Stop the on-device live transcription before unwinding the rest —
    // any further partial-result event would otherwise overwrite the
    // about-to-arrive Whisper result.
    speechRecognition.stop();
    setTranslatedText('');
    // Capture the audio URI before transcription so a failed Whisper call
    // (e.g. connection dropped between record-end and the API request) is
    // recoverable via Retry without losing what the user just dictated.
    const audioUri = await stopRecording();
    setPendingAudioUri(audioUri);
    try {
      // The picker commits to one source language for single-shot, so the
      // hint goes straight to Whisper — `runTranslation` then routes
      // direction within the pair from the detected language as before.
      // Hinting fixes a real on-device class of bug where Whisper
      // auto-detected English on short Spanish clips and hallucinated
      // (often repeated) English phrases like "Hello, how are you?".
      const { text, detectedCode } = await transcribeForTranslation(
        audioUri,
        source.code,
      );
      setPendingAudioUri(null);
      // Whisper's text replaces whatever the on-device partial settled on —
      // happens automatically via `runTranslation` → `setOriginalText`.
      await runTranslation(text, detectedCode);
    } catch (e: unknown) {
      setError(classifyError(e));
    } finally {
      setProcessing(false);
    }
  }, [source.code, runTranslation]);

  const handleVoiceAutoStop = useCallback(
    async (reason: Exclude<AutoStopReason, null>) => {
      if (reason === 'noSpeech') {
        // VAD never heard a frame above threshold — tear down without
        // calling Whisper, surface the prompt to retry.
        setRecording(false);
        speechRecognition.stop();
        await stopRecording();
        setError(
          new AppError(AppErrorType.NoSpeech, "Didn't catch that — tap to try again."),
        );
        return;
      }
      // 'silence' or 'maxDuration' — speech was captured, run the
      // normal pipeline.
      await stopRecordingAndTranscribe();
    },
    [stopRecordingAndTranscribe],
  );

  const voiceVad = useSilenceDetection({
    isRecording: recording,
    onAutoStop: handleVoiceAutoStop,
  });

  const handleRecordPress = useCallback(async () => {
    if (recording) {
      await stopRecordingAndTranscribe();
      return;
    }

    if (!guardOnline()) return;
    setError(null);
    // A new recording supersedes any previous retryable state and any
    // result still on screen from the previous attempt.
    setPendingAudioUri(null);
    setLastTranscription(null);
    setOriginalText('');
    setTranslatedText('');
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert('Permission needed', 'Microphone access is required for voice translation.');
      return;
    }
    setRecording(true);
    await startRecording(voiceVad.onLevel);
    // Live transcript bias: pick the source language the picker is on. If the
    // user actually speaks the target instead, the partial will read as
    // gibberish — but Whisper still routes the final result correctly, so
    // it's a cosmetic glitch on the preview only.
    void speechRecognition.start(source.code, setOriginalText);
  }, [recording, guardOnline, source.code, stopRecordingAndTranscribe, voiceVad.onLevel]);

  const handleRetryTranslation = useCallback(() => {
    if (!lastTranscription || processing) return;
    if (!guardOnline()) return;
    setError(null);
    setProcessing(true);
    setTranslatedText('');
    translateTextStreaming(
      lastTranscription.text,
      lastTranscription.source,
      lastTranscription.target,
      setTranslatedText,
    )
      .catch((e: unknown) => setError(classifyError(e)))
      .finally(() => setProcessing(false));
  }, [lastTranscription, processing, guardOnline]);

  /**
   * Voice-path retry — re-runs the transcribe step (and onward to translate)
   * using the audio URI saved when the recording stopped. Used when the
   * Whisper call failed; the typed-text path doesn't need this because the
   * input field already preserves the user's text.
   */
  const handleRetryFromAudio = useCallback(async () => {
    if (!pendingAudioUri || processing) return;
    if (!guardOnline()) return;
    setError(null);
    setProcessing(true);
    setOriginalText('');
    setTranslatedText('');
    try {
      const { text, detectedCode } = await transcribeForTranslation(
        pendingAudioUri,
        source.code,
      );
      setPendingAudioUri(null);
      await runTranslation(text, detectedCode);
    } catch (e: unknown) {
      setError(classifyError(e));
    } finally {
      setProcessing(false);
    }
  }, [pendingAudioUri, processing, guardOnline, runTranslation, source.code]);

  // Unified Retry handler. Three branches, ordered by what is actually
  // recoverable:
  //   1. NoSpeech — the audio was silent; re-running Whisper on the same
  //      file is deterministic and returns the same error. The only
  //      meaningful retry is a new recording, so we kick off
  //      `handleRecordPress` (which already clears the stale audio URI and
  //      starts a fresh capture).
  //   2. A surviving transcription means the translate step is what failed
  //      (e.g. network drop after Whisper succeeded) — replay just that.
  //   3. Otherwise we still have the original recording and the failure was
  //      transient (network, timeout, etc.) — re-transcribe from audio.
  const handleRetry = useCallback(() => {
    if (error?.type === AppErrorType.NoSpeech) {
      void handleRecordPress();
      return;
    }
    if (lastTranscription) {
      handleRetryTranslation();
    } else if (pendingAudioUri) {
      void handleRetryFromAudio();
    }
  }, [
    error,
    lastTranscription,
    pendingAudioUri,
    handleRecordPress,
    handleRetryTranslation,
    handleRetryFromAudio,
  ]);

  const handleConversationRecord = useCallback(() => {
    if (convState.status === 'recording') {
      void endRecording();
      return;
    }
    // While a translation is being read aloud, the button interrupts it.
    if (convState.status === 'speaking') {
      stopSpeaking();
      return;
    }
    if (!guardOnline()) return;
    void beginRecording();
  }, [convState.status, guardOnline, beginRecording, endRecording, stopSpeaking]);

  const convBusy = CONVERSATION_BUSY.includes(convState.status);
  // `speaking` is "busy" for the trail, but the record button stays live
  // during it so the user can interrupt playback.
  const convSpeaking = convState.status === 'speaking';
  const trailState: TrailState =
    mode === 'conversation'
      ? convState.status === 'recording'
        ? 'recording'
        : convBusy
          ? 'processing'
          : 'idle'
      : recording
        ? 'recording'
        : processing
          ? 'processing'
          : 'idle';

  // ── Consent gate ──
  // Front-loaded per Apple 5.1.2(i) (Nov 2025) and EU AI Act Art. 50
  // (Aug 2026): the third-party-AI disclosure must precede any UI that
  // could lead to a transmission. Showing it before the setup screen
  // (rather than after) also removes the "you asked for my key, *then*
  // told me where it goes" friction — the recurring App Store rejection
  // pattern is in-context / inline consent (Apple Dev Forum #820209,
  // Mar 2026). `hasConsent === null` means the AsyncStorage read hasn't
  // resolved yet — we hold the previous screen for that brief tick.
  if (hasConsent === false) {
    return (
      <PrivacyConsent
        onAgree={handleConsentAgree}
        onDecline={handleConsentDecline}
      />
    );
  }

  // ── API key setup screen ──
  if (!isReady) {
    return (
      <View className="flex-1 bg-base">
        <EdgeTrail state="idle" />
        <StatusBar style="light" />
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-center px-6"
          >
            <View testID={testIDs.setup.screen}>
              <View className="mb-1 items-center">
                <Wordmark size="lg" />
              </View>
              <Text className="mb-8 text-center text-sm text-fg-muted">
                Voice & text translator built with OpenAI Whisper and GPT-4o-mini
              </Text>

              <View className="rounded-2xl border border-neon/20 bg-surface p-6">
                <Text className="mb-2 font-mono text-xs uppercase tracking-[2px] text-neon">
                  OpenAI API key
                </Text>
                <Text className="mb-4 text-[13px] leading-5 text-fg-muted">
                  Get one at platform.openai.com. Your key is stored securely on
                  this device only.
                </Text>
                <TextInput
                  testID={testIDs.setup.apiKeyInput}
                  accessibilityLabel="OpenAI API key"
                  className="mb-4 rounded-xl border border-neon/20 bg-surface-input p-3.5 text-base text-fg"
                  placeholder="sk-..."
                  placeholderTextColor={colors.fgFaint}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <Pressable
                  testID={testIDs.setup.saveButton}
                  accessibilityRole="button"
                  accessibilityLabel="Save key and start"
                  onPress={handleSaveKey}
                  className="items-center rounded-xl border border-neon bg-neon/10 py-3.5"
                >
                  <Text className="font-mono text-sm uppercase tracking-[2px] text-neon">
                    Save & Start
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ── Main translator screen ──
  const isConversation = mode === 'conversation';
  // Active stages of the single-mode pipeline before the result card has
  // anything to show. Each stage replaces the resting "Speak or type to
  // translate" hint with a tailored loading state, so the user always sees a
  // visible signal that work is in flight (was a tester confusion point —
  // the resting hint looked like nothing was happening during processing).
  // Voice: Listening → Transcribing → (card mounts with Translating
  // placeholder) → done. Typed: (Go) → Translating → (card mounts) → done;
  // there's no separate transcribe step from the user's point of view, so
  // the brief detectLanguage call is labeled as Translating to keep the
  // copy consistent with what they're about to see in the card.
  //
  // `Listening…` only shows while there is *no* partial text yet — once the
  // on-device live transcript starts streaming words into `originalText`,
  // the `TranslationCard` renders them in the source card and this fallback
  // hint stays out of the way. The hint also remains the only signal on
  // devices where speech recognition is unavailable (denied permission,
  // unsupported locale, or the dev client wasn't rebuilt with the SR
  // plugin yet), so the user still knows the mic is active.
  const showListeningHint = !isConversation && recording && !originalText;
  const showPreCardBusyHint =
    !isConversation &&
    processing &&
    !originalText &&
    !translatedText &&
    !error;
  const preCardBusyLabel = inputMode === 'typed' ? 'Translating…' : 'Transcribing…';
  const showEmptyHint =
    !isConversation &&
    !originalText &&
    !translatedText &&
    !error &&
    !recording &&
    !processing;
  const canTranslateText = textInput.trim().length > 0 && !processing && !recording;

  return (
    <View className="flex-1 bg-base">
      <EdgeTrail state={trailState} />
      <StatusBar style="light" />
      <SafeAreaView className="flex-1">
        <OfflineBanner isOffline={isOffline} />

        <View
          // HEADER_TOP_OFFSET (20) is the clearance between the trail's
          // top edge (flush with safe-area boundary) and the header
          // buttons. Single source of truth in `constants/layout.ts`.
          style={{
            paddingTop: HEADER_TOP_OFFSET,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Wordmark size="sm" />
            {/* Persistent AI-provider indicator. EU AI Act Art. 50
                (effective 2 August 2026) requires users to be informed
                that they are interacting with AI in a clear, persistent
                way — a one-shot consent screen is necessary but not on
                its own sufficient. Kept compact so it does not crowd
                the header. */}
            <Text className="mt-0.5 font-mono text-[10px] uppercase tracking-[1.5px] text-fg-faint">
              via OpenAI
            </Text>
          </View>
          <View className="flex-row gap-2">
            {isConversation && convState.session.turns.length > 0 ? (
              <Pressable
                testID={testIDs.conversation.newSessionButton}
                accessibilityRole="button"
                accessibilityLabel="Start a new conversation"
                onPress={startNewSession}
                className="rounded-lg border border-neon/25 px-3 py-1.5"
              >
                <Text className="font-mono text-[11px] uppercase tracking-[2px] text-fg-muted">
                  + New
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              testID={testIDs.history.button}
              accessibilityRole="button"
              accessibilityLabel="Open translation history"
              onPress={() => setShowHistory(true)}
              className="rounded-lg border border-neon/25 px-3 py-1.5"
            >
              <Text className="font-mono text-[11px] uppercase tracking-[2px] text-fg-muted">
                History
              </Text>
            </Pressable>
            <Pressable
              testID={testIDs.header.settingsButton}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => setShowSettings(true)}
              className="rounded-lg border border-neon/25 px-2.5 py-1.5"
            >
              {/* Gear icon replaces the "SETTINGS" text label — on small
                  screens (iPhone 12 mini width ≈ 375 pt) the full word
                  overflowed past the right edge once "+ New" joined the
                  cluster. The `︎` variation selector forces text
                  presentation so iOS renders a monochrome glyph instead
                  of a coloured emoji, matching the Tron mono aesthetic
                  the rest of the icon set uses (▶ / ■ / ⎘). */}
              <Text className="font-mono text-[14px] leading-[14px] text-fg-muted">
                {'⚙︎'}
              </Text>
            </Pressable>
          </View>
        </View>

        <ModeToggle mode={mode} onChange={handleModeChange} />

        <LanguagePicker
          source={source}
          target={target}
          onChangeSource={setSource}
          onChangeTarget={setTarget}
          onSwap={handleSwapLanguages}
        />

        {isConversation ? (
          <ConversationView
            session={convState.session}
            // Render a non-interactive preview bubble across the whole
            // in-flight pipeline:
            //  • status === recording → no draft yet; we synthesize one
            //    from `liveTranscript` so the user sees their own words
            //    arriving as they speak.
            //  • status === translating → `state.draft` carries Whisper's
            //    final text + the routed source/target; `liveTranslation`
            //    streams in the target half.
            // Outside those two windows the preview unmounts.
            previewDraft={
              convState.status === 'translating'
                ? convState.draft
                : convState.status === 'recording' && convLiveTranscript
                  ? {
                      id: '__live__',
                      sourceLang: convState.session.langA,
                      targetLang: convState.session.langB,
                      originalText: convLiveTranscript,
                      createdAt: Date.now(),
                    }
                  : null
            }
            previewTranslation={convLiveTranslation}
            previewPhase={
              convState.status === 'translating'
                ? 'translating'
                : convState.status === 'recording' && convLiveTranscript
                  ? 'recording'
                  : null
            }
            hideOriginal={hideOriginal}
          />
        ) : (
          <View className="flex-1 px-5">
            <TranslationCard
              originalText={originalText}
              translatedText={translatedText}
              sourceLabel={lastTranscription?.source ?? source.name}
              targetLabel={lastTranscription?.target ?? target.name}
              targetLangCode={lastTranscription?.targetCode ?? target.code}
              isTranslating={processing}
            />

            {showListeningHint ? (
              <View className="flex-1 items-center justify-center">
                <Text className="text-center font-mono text-xs uppercase tracking-[2px] text-neon">
                  Listening…
                </Text>
              </View>
            ) : null}

            {showPreCardBusyHint ? (
              <View className="flex-1 items-center justify-center">
                <View className="flex-row items-center gap-3">
                  <ActivityIndicator size="small" color={colors.neon} />
                  <Text className="font-mono text-xs uppercase tracking-[2px] text-neon">
                    {preCardBusyLabel}
                  </Text>
                </View>
              </View>
            ) : null}

            {showEmptyHint ? (
              <View className="flex-1 items-center justify-center">
                <Text className="text-center font-mono text-xs uppercase tracking-[2px] text-fg-faint">
                  {inputMode === 'typed'
                    ? 'Type to translate'
                    : 'Speak or type to translate'}
                </Text>
              </View>
            ) : null}

            {/* Error / retry has moved to the bottom bar — see the
                single-shot branch of the bottom-bar conditional below.
                Rendering it here pushed the TranslationCard's
                scrollable viewport, which then clipped the previous
                translation result the user was still reading. */}
          </View>
        )}

        <KeyboardAvoidingView
          // `padding` on both platforms: it lifts this bottom bar above the
          // keyboard. Android needs it too — under Expo's edge-to-edge the
          // window no longer auto-resizes, so without this the keyboard
          // covers the text input.
          behavior="padding"
          // PILL_BOTTOM_OFFSET (8) is the single source of truth that the
          // trail's bottom edge derives from — see `constants/layout.ts`.
          // Changing the bottom padding here must go through that
          // constant, otherwise the trail-through-pill-centre alignment
          // drifts.
          style={{ paddingBottom: PILL_BOTTOM_OFFSET, paddingHorizontal: 20 }}
        >
          {/* Single-shot error surface — sits above the inputMode-specific
              row (typed or voice) so the TranslationCard above stays at
              full height, with the previous translation result still
              fully visible while the user reads the error. Conversation
              mode has its own status/error line below. */}
          {!isConversation && error ? (
            <View className="mb-3 items-center">
              <Text
                testID={testIDs.translation.errorText}
                className="text-center text-[13px] text-danger"
              >
                {error.message}
              </Text>
              {(lastTranscription || pendingAudioUri) ? (
                <View className="mt-2 flex-row gap-3">
                  <PillButton
                    testID={testIDs.translation.retryButton}
                    accessibilityLabel={
                      error.type === AppErrorType.NoSpeech
                        ? 'Record again'
                        : lastTranscription
                          ? 'Retry translation'
                          : 'Retry from recording'
                    }
                    onPress={handleRetry}
                    tone="strong"
                  >
                    {error.type === AppErrorType.NoSpeech ? 'Record again' : 'Retry'}
                  </PillButton>
                  <PillButton
                    accessibilityLabel="Dismiss error"
                    onPress={() => setError(null)}
                    tone="subtle"
                  >
                    Dismiss
                  </PillButton>
                </View>
              ) : null}
            </View>
          ) : null}

          {/*
            Top of the bottom bar:
            – conversation mode: status / error line above the record button;
            – single + typed: the text input row;
            – single + voice: nothing — the record button below is the whole
              surface, no second input competes with it for attention.
          */}
          {isConversation ? (
            <View className="mb-3 min-h-[20px] items-center">
              {convState.status === 'error' ? (
                <View className="items-center">
                  <Pressable
                    testID={testIDs.conversation.errorText}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss error"
                    onPress={dismissConvError}
                  >
                    <Text className="text-center text-[13px] text-danger">
                      {convState.error}
                    </Text>
                  </Pressable>
                  {convState.errorType === AppErrorType.NoSpeech ||
                  convState.retryDraft ||
                  convState.pendingAudioUri ? (
                    <View className="mt-2 flex-row gap-3">
                      <PillButton
                        testID={testIDs.conversation.retryButton}
                        accessibilityLabel={
                          convState.errorType === AppErrorType.NoSpeech
                            ? 'Record again'
                            : 'Retry this turn'
                        }
                        onPress={() => void retryTurn()}
                        tone="strong"
                      >
                        {convState.errorType === AppErrorType.NoSpeech
                          ? 'Record again'
                          : 'Retry'}
                      </PillButton>
                      <PillButton
                        accessibilityLabel="Dismiss error"
                        onPress={dismissConvError}
                        tone="subtle"
                      >
                        Dismiss
                      </PillButton>
                    </View>
                  ) : (
                    <Text className="mt-1 font-mono text-[10px] uppercase tracking-[2px] text-fg-faint">
                      tap to dismiss
                    </Text>
                  )}
                </View>
              ) : (
                <Text
                  testID={testIDs.conversation.statusText}
                  className="font-mono text-[11px] uppercase tracking-[2px] text-fg-muted"
                >
                  {CONVERSATION_STATUS_LABEL[convState.status]}
                </Text>
              )}
            </View>
          ) : inputMode === 'typed' ? (
            <View className="mb-4 flex-row items-end gap-2">
              <TextInput
                testID={testIDs.textInput.field}
                accessibilityLabel="Text to translate"
                className="flex-1 rounded-xl border border-neon/20 bg-surface-input px-3.5 py-3 text-base text-fg"
                placeholder="Type to translate…"
                placeholderTextColor={colors.fgFaint}
                value={textInput}
                onChangeText={setTextInput}
                editable={!recording}
                // Switching into typed mode mounts this input — auto-focus so
                // the keyboard appears without an extra tap.
                autoFocus
                // Multi-line input. Enter inserts a newline; submitting is the
                // explicit `Go` button next to the field — matches every major
                // translator (Google / DeepL / MS / Apple) and chat app
                // (ChatGPT / Telegram / WhatsApp / iMessage). The single-line
                // `onSubmitEditing` path was non-standard for translation and
                // prevented multi-sentence input.
                multiline
                textAlignVertical="top"
                // Cap the input height at ~5 lines before it starts scrolling
                // internally, so a long paragraph does not crowd the result
                // card or the Go button.
                style={{ minHeight: 48, maxHeight: 144 }}
              />
              <Animated.View
                ref={goHighlight.ref}
                style={[
                  {
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor: canTranslateText
                      ? 'rgba(0,255,240,0.1)'
                      : 'transparent',
                  },
                  goHighlight.borderStyle,
                ]}
              >
                <Pressable
                  testID={testIDs.textInput.translateButton}
                  accessibilityRole="button"
                  accessibilityLabel="Translate text"
                  accessibilityState={{ disabled: !canTranslateText }}
                  onPress={handleTranslateText}
                  disabled={!canTranslateText}
                  style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                >
                  <Text
                    className={`font-mono text-xs uppercase tracking-[2px] ${
                      canTranslateText ? 'text-neon' : 'text-fg-faint'
                    }`}
                  >
                    Go
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          ) : null}

          {/* The record button is the hero in voice mode (single or
              conversation); typed mode replaces it with the text input above.
              It registers its own label with the trail highlight system
              internally — App.tsx doesn't have to plumb a ref through. */}
          {isConversation || inputMode === 'voice' ? (
            <RecordButton
              isRecording={isConversation ? convState.status === 'recording' : recording}
              isProcessing={isConversation ? convBusy && !convSpeaking : processing}
              isSpeaking={isConversation && convSpeaking}
              onPress={isConversation ? handleConversationRecord : handleRecordPress}
              // In conversation mode there is no TYPE pill to anchor the
              // trail's bottom edge, so the label "TAP TO SPEAK" becomes
              // the anchor itself.
              anchorBottom={isConversation}
              // The conversation status line above the button already says
              // "Tap to speak the next turn"; the visible caption below is
              // redundant. Keep it mounted (opacity 0) so the anchor still
              // has a measurable element.
              hideLabel={isConversation}
              level={isConversation ? convLevel : voiceVad.level}
              hasHeardSpeech={isConversation ? convHasHeardSpeech : voiceVad.hasHeardSpeech}
            />
          ) : null}

          {/*
            Single-mode input-mode toggle — a small pill below the main
            surface. Voice → Type swaps to the input field; Type → Voice
            swaps back and dismisses the keyboard. The conversation "New
            session" affordance used to live in this slot; it moved to the
            header (next to History/Settings) to keep destructive controls
            away from the record button's misclick radius.
          */}
          {!isConversation ? (
            <View className="mt-3 flex-row justify-center">
              {inputMode === 'voice' ? (
                <PillButton
                  testID={testIDs.textInput.toggleToTyped}
                  accessibilityLabel="Type instead"
                  onPress={() => setInputMode('typed')}
                  anchor
                >
                  ✎ Type
                </PillButton>
              ) : (
                <PillButton
                  testID={testIDs.textInput.toggleToVoice}
                  accessibilityLabel="Use voice"
                  onPress={() => {
                    setInputMode('voice');
                    Keyboard.dismiss();
                  }}
                >
                  ◉ Voice
                </PillButton>
              )}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SettingsScreen
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onLogout={handleLogout}
        onResetConsent={handleResetConsent}
        speakAloud={speakAloud}
        onToggleSpeakAloud={handleToggleSpeakAloud}
        hideOriginal={hideOriginal}
        onToggleHideOriginal={handleToggleHideOriginal}
      />

      <HistoryScreen
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectSession={handleSelectSession}
        onSelectSingleShot={handleSelectSingleShot}
        currentSessionId={convState.session.id}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TrailHighlightProvider>
        <AppContent />
      </TrailHighlightProvider>
    </SafeAreaProvider>
  );
}
