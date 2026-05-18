import { useCallback, useEffect, useReducer } from 'react';

import {
  createSession,
  pickLatestForPair,
  type ConversationSession,
} from '../constants/conversation';
import { resolveDirection } from '../constants/languages';
import { requestPermissions, startRecording, stopRecording } from '../services/audio';
import { classifyError, userMessage } from '../services/errors';
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
      dispatch({ type: 'ERROR', message: userMessage(classifyError(e)) });
    }
  }, []);

  const endRecording = useCallback(async () => {
    dispatch({ type: 'RECORDING_STOPPED' });
    try {
      const { text, detectedCode } = await transcribeForTranslation(
        await stopRecording(),
      );
      const dir = resolveDirection(
        detectedCode,
        state.session.langA,
        state.session.langB,
      );
      const draft: TurnDraft = {
        id: generateId(),
        sourceLang: dir.sourceLang,
        targetLang: dir.targetLang,
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
      dispatch({ type: 'ERROR', message: userMessage(classifyError(e)) });
    }
  }, [state.session.langA, state.session.langB, speakAloud]);

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
    dismissError,
    startNewSession,
    resumeOrStart,
    loadSession,
    stopSpeaking,
  };
}
