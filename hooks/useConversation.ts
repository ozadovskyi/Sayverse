import { useCallback, useEffect, useReducer } from 'react';

import {
  createSession,
  pickLatestForPair,
  type ConversationSession,
} from '../constants/conversation';
import { findByCode, resolveDirection } from '../constants/languages';
import { requestPermissions, startRecording, stopRecording } from '../services/audio';
import { AppErrorType, classifyError, userMessage } from '../services/errors';
import { translateText } from '../services/openai';
import { transcribeForTranslation } from '../services/translation';
import { tts } from '../services/tts';
import { loadSessions, saveSession } from '../storage/conversationStorage';
import {
  conversationReducer,
  initialConversationState,
  type TurnDraft,
} from './conversationReducer';

/** Reasonably-unique id for sessions and turns. */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Impure shell around `conversationReducer`: runs the audio / Whisper /
 * translation / TTS pipeline and dispatches the pure state transitions.
 */
export function useConversation(
  langA: string,
  langB: string,
  speakAloud: boolean,
) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, () =>
    initialConversationState(createSession(generateId(), langA, langB, Date.now())),
  );

  // Persist the session once it has turns worth keeping.
  useEffect(() => {
    if (state.session.turns.length > 0) void saveSession(state.session);
  }, [state.session]);

  const beginRecording = useCallback(async () => {
    dispatch({ type: 'START_RECORDING' });
    try {
      const granted = await requestPermissions();
      if (!granted) {
        dispatch({ type: 'ERROR', message: 'Microphone access is required.' });
        return;
      }
      await startRecording();
    } catch (e: unknown) {
      const err = classifyError(e);
      dispatch({ type: 'ERROR', message: userMessage(err), errorType: err.type });
    }
  }, []);

  /**
   * Run the transcribe-and-translate pipeline from a recorded audio URI. The
   * audio URI is held in the reducer (via `RECORDING_STOPPED`) so a failure
   * here leaves enough state for {@link retryTurn} to resume.
   */
  const runFromAudio = useCallback(
    async (audioUri: string | null | undefined) => {
      try {
        const { text, detectedCode } = await transcribeForTranslation(audioUri);
        const dir = resolveDirection(
          detectedCode,
          state.session.langA,
          state.session.langB,
        );
        const draft: TurnDraft = {
          id: generateId(),
          sourceLang: dir.sourceLang,
          targetLang: dir.targetLang,
          // The language Whisper actually heard, normalized to an ISO code.
          // Kept distinct from the routed `sourceLang` so the UI can show both.
          detectedLang: findByCode(detectedCode)?.code,
          originalText: text,
          createdAt: Date.now(),
        };
        dispatch({ type: 'TRANSCRIBED', draft });

        const translated = await translateText(text, dir.sourceName, dir.targetName);
        dispatch({ type: 'TRANSLATED', translatedText: translated });

        // Speaking the translation aloud is opt-in (Settings → Voice).
        if (speakAloud) await tts.speak(translated, dir.targetLang);
        dispatch({ type: 'SPEAKING_DONE' });
      } catch (e: unknown) {
        const err = classifyError(e);
        dispatch({ type: 'ERROR', message: userMessage(err), errorType: err.type });
      }
    },
    [state.session.langA, state.session.langB, speakAloud],
  );

  /**
   * Re-run translation for a draft that survived a translate-stage failure —
   * the transcription does not need to be repeated.
   */
  const runFromDraft = useCallback(
    async (draft: TurnDraft) => {
      try {
        const dir = resolveDirection(
          draft.detectedLang ?? draft.sourceLang,
          state.session.langA,
          state.session.langB,
        );
        const translated = await translateText(
          draft.originalText,
          dir.sourceName,
          dir.targetName,
        );
        dispatch({ type: 'TRANSLATED', translatedText: translated });
        if (speakAloud) await tts.speak(translated, dir.targetLang);
        dispatch({ type: 'SPEAKING_DONE' });
      } catch (e: unknown) {
        const err = classifyError(e);
        dispatch({ type: 'ERROR', message: userMessage(err), errorType: err.type });
      }
    },
    [state.session.langA, state.session.langB, speakAloud],
  );

  const endRecording = useCallback(async () => {
    const audioUri = await stopRecording();
    dispatch({ type: 'RECORDING_STOPPED', audioUri });
    await runFromAudio(audioUri);
  }, [runFromAudio]);

  /**
   * Resume a failed turn from the most useful preserved checkpoint:
   * - NoSpeech (the captured audio was silent) — re-running Whisper on the
   *   same file would just repeat the error, so we start a fresh recording
   *   via `beginRecording`. Matches the single-mode Retry behaviour.
   * - the draft (translate stage) if transcription already succeeded;
   * - otherwise the audio URI (transcribe stage).
   *
   * Reducer's RETRY action mirrors the latter two choices and updates
   * `status` first; the impure pipeline is replayed here.
   */
  const retryTurn = useCallback(async () => {
    if (state.status !== 'error') return;
    if (state.errorType === AppErrorType.NoSpeech) {
      await beginRecording();
      return;
    }
    if (state.retryDraft) {
      const draft = state.retryDraft;
      dispatch({ type: 'RETRY' });
      await runFromDraft(draft);
      return;
    }
    if (state.pendingAudioUri) {
      const uri = state.pendingAudioUri;
      dispatch({ type: 'RETRY' });
      await runFromAudio(uri);
    }
  }, [
    state.status,
    state.errorType,
    state.retryDraft,
    state.pendingAudioUri,
    beginRecording,
    runFromAudio,
    runFromDraft,
  ]);

  const dismissError = useCallback(() => {
    dispatch({ type: 'DISMISS_ERROR' });
  }, []);

  const startNewSession = useCallback(() => {
    tts.stop();
    dispatch({
      type: 'NEW_SESSION',
      session: createSession(generateId(), langA, langB, Date.now()),
    });
  }, [langA, langB]);

  /**
   * Resume the most recent persisted conversation for the current language
   * pair, or start a fresh one if there is none. Called on entering
   * conversation mode so a chat survives an app restart.
   */
  const resumeOrStart = useCallback(async () => {
    tts.stop();
    try {
      const previous = pickLatestForPair(await loadSessions(), langA, langB);
      if (previous) {
        dispatch({ type: 'LOAD_SESSION', session: previous });
        return;
      }
    } catch {
      // Unreadable storage — fall through to a fresh session rather than crash.
    }
    dispatch({
      type: 'NEW_SESSION',
      session: createSession(generateId(), langA, langB, Date.now()),
    });
  }, [langA, langB]);

  /** Load a specific session — used by the History browser. */
  const loadSession = useCallback((session: ConversationSession) => {
    tts.stop();
    dispatch({ type: 'LOAD_SESSION', session });
  }, []);

  /**
   * Interrupt speak-aloud playback. Stopping the speech resolves the pending
   * `tts.speak` in `endRecording`, which then dispatches `SPEAKING_DONE` —
   * so the turn-taking machine returns to `idle` on its own.
   */
  const stopSpeaking = useCallback(() => {
    tts.stop();
  }, []);

  return {
    state,
    beginRecording,
    endRecording,
    retryTurn,
    dismissError,
    startNewSession,
    resumeOrStart,
    loadSession,
    stopSpeaking,
  };
}
