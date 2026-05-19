import type {
  ConversationSession,
  ConversationTurn,
} from '../constants/conversation';

/**
 * The conversation turn-taking state machine.
 *
 * Pure — no React, no React Native, no I/O — so it is exhaustively unit
 * tested in clean Node. The `useConversation` hook is the impure shell that
 * runs the audio / OpenAI / TTS calls and dispatches these actions.
 */

export type ConversationStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'translating'
  | 'speaking'
  | 'error';

/**
 * A turn under construction: created when transcription lands, completed
 * into a `ConversationTurn` when the translation arrives.
 */
export interface TurnDraft {
  id: string;
  sourceLang: string;
  targetLang: string;
  /** ISO code Whisper detected — see {@link ConversationTurn.detectedLang}. */
  detectedLang?: string;
  originalText: string;
  createdAt: number;
}

export interface ConversationState {
  status: ConversationStatus;
  session: ConversationSession;
  draft: TurnDraft | null;
  error: string | null;
}

export type ConversationAction =
  | { type: 'START_RECORDING' }
  | { type: 'RECORDING_STOPPED' }
  | { type: 'TRANSCRIBED'; draft: TurnDraft }
  | { type: 'TRANSLATED'; translatedText: string }
  | { type: 'SPEAKING_DONE' }
  | { type: 'ERROR'; message: string }
  | { type: 'DISMISS_ERROR' }
  | { type: 'NEW_SESSION'; session: ConversationSession }
  | { type: 'LOAD_SESSION'; session: ConversationSession };

export function initialConversationState(
  session: ConversationSession,
): ConversationState {
  return { status: 'idle', session, draft: null, error: null };
}

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case 'START_RECORDING':
      // Accepted when ready (idle) or recovering from a failed turn (error).
      if (state.status !== 'idle' && state.status !== 'error') return state;
      return { ...state, status: 'recording', error: null };

    case 'RECORDING_STOPPED':
      if (state.status !== 'recording') return state;
      return { ...state, status: 'transcribing' };

    case 'TRANSCRIBED':
      if (state.status !== 'transcribing') return state;
      return { ...state, status: 'translating', draft: action.draft };

    case 'TRANSLATED': {
      if (state.status !== 'translating' || !state.draft) return state;
      // The turn is committed to the thread now, while TTS plays it back.
      const turn: ConversationTurn = {
        id: state.draft.id,
        sourceLang: state.draft.sourceLang,
        targetLang: state.draft.targetLang,
        detectedLang: state.draft.detectedLang,
        originalText: state.draft.originalText,
        translatedText: action.translatedText,
        createdAt: state.draft.createdAt,
      };
      return {
        ...state,
        status: 'speaking',
        draft: null,
        session: {
          ...state.session,
          turns: [...state.session.turns, turn],
          updatedAt: turn.createdAt,
        },
      };
    }

    case 'SPEAKING_DONE':
      if (state.status !== 'speaking') return state;
      return { ...state, status: 'idle' };

    case 'ERROR':
      // Reachable from any step. Any half-built draft is discarded; a turn
      // already committed (e.g. TTS failed during `speaking`) is kept.
      return { ...state, status: 'error', error: action.message, draft: null };

    case 'DISMISS_ERROR':
      if (state.status !== 'error') return state;
      return { ...state, status: 'idle', error: null };

    case 'NEW_SESSION':
    case 'LOAD_SESSION':
      return {
        status: 'idle',
        session: action.session,
        draft: null,
        error: null,
      };

    default:
      return state;
  }
}
