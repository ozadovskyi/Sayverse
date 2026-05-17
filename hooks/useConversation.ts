import { useCallback, useEffect, useReducer } from 'react';

import {
  createSession,
  pickLatestForPair,
  type ConversationSession,
} from '../constants/conversation';
import { findByCode } from '../constants/languages';
import { requestPermissions, startRecording, stopRecording } from '../services/audio';
import { classifyError, userMessage } from '../services/errors';
import { transcribeAudio, translateText } from '../services/openai';
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
 * Auto-detect routing: given the language Whisper detected, decide which way
 * the turn translates. If the speaker used `langB`, translate to `langA`;
 * otherwise (they used `langA`, or detection was inconclusive) translate to
 * `langB`.
 */
function routeLanguages(detectedCode: string | undefined, langA: string, langB: string) {
  return detectedCode === langB
    ? { sourceLang: langB, targetLang: langA }
    : { sourceLang: langA, targetLang: langB };
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
      const uri = await stopRecording();
      if (!uri) {
        dispatch({ type: 'ERROR', message: 'No audio was recorded.' });
        return;
      }
      const { text, language } = await transcribeAudio(uri);
      if (!text.trim()) {
        dispatch({ type: 'ERROR', message: 'Nothing was heard — try again.' });
        return;
      }

      const detected = findByCode(language);
      const { sourceLang, targetLang } = routeLanguages(
        detected?.code,
        state.session.langA,
        state.session.langB,
      );
      const draft: TurnDraft = {
        id: generateId(),
        sourceLang,
        targetLang,
        originalText: text,
        createdAt: Date.now(),
      };
      dispatch({ type: 'TRANSCRIBED', draft });

      const sourceName = findByCode(sourceLang)?.name ?? sourceLang;
      const targetName = findByCode(targetLang)?.name ?? targetLang;
      const translated = await translateText(text, sourceName, targetName);
      dispatch({ type: 'TRANSLATED', translatedText: translated });

      // Speaking the translation aloud is opt-in (Settings → Voice).
      if (speakAloud) await tts.speak(translated, targetLang);
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

  return {
    state,
    beginRecording,
    endRecording,
    dismissError,
    startNewSession,
    resumeOrStart,
    loadSession,
  };
}
