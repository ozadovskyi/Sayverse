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
  /**
   * The audio URI captured when the recording stopped, held across the
   * transcribe-and-translate pipeline so a network drop is recoverable: when
   * a step fails the URI is still here for the Retry path. Cleared on
   * commit (`TRANSLATED`) and on session changes / dismiss.
   */
  pendingAudioUri: string | null;
  /**
   * A draft preserved from a failed translate step so Retry can resume from
   * translate rather than re-transcribe (cheaper, and the recorded text the
   * user already saw stays the same). Cleared on commit and session changes.
   */
  retryDraft: TurnDraft | null;
}

export type ConversationAction =
  | { type: 'START_RECORDING' }
  | { type: 'RECORDING_STOPPED'; audioUri?: string | null }
  | { type: 'TRANSCRIBED'; draft: TurnDraft }
  | { type: 'TRANSLATED'; translatedText: string }
  | { type: 'SPEAKING_DONE' }
  | { type: 'ERROR'; message: string }
  | { type: 'DISMISS_ERROR' }
  | { type: 'RETRY' }
  | { type: 'NEW_SESSION'; session: ConversationSession }
  | { type: 'LOAD_SESSION'; session: ConversationSession };

export function initialConversationState(
  session: ConversationSession,
): ConversationState {
  return {
    status: 'idle',
    session,
    draft: null,
    error: null,
    pendingAudioUri: null,
    retryDraft: null,
  };
}

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case 'START_RECORDING':
      // Accepted when ready (idle) or recovering from a failed turn (error).
      // Starting a new recording discards any prior retry context.
      if (state.status !== 'idle' && state.status !== 'error') return state;
      return {
        ...state,
        status: 'recording',
        error: null,
        pendingAudioUri: null,
        retryDraft: null,
      };

    case 'RECORDING_STOPPED':
      if (state.status !== 'recording') return state;
      return {
        ...state,
        status: 'transcribing',
        pendingAudioUri: action.audioUri ?? null,
      };

    case 'TRANSCRIBED':
      if (state.status !== 'transcribing') return state;
      return { ...state, status: 'translating', draft: action.draft };

    case 'TRANSLATED': {
      if (state.status !== 'translating' || !state.draft) return state;
      // The turn is committed to the thread now, while TTS plays it back.
      // Retry context is cleared: the call succeeded.
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
        pendingAudioUri: null,
        retryDraft: null,
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
      // Reachable from any step. Any half-built draft is moved into
      // `retryDraft` so the Retry path can resume from translate; the audio
      // URI is left in place for the transcribe-stage retry case.
      return {
        ...state,
        status: 'error',
        error: action.message,
        draft: null,
        retryDraft: state.draft ?? state.retryDraft,
      };

    case 'DISMISS_ERROR':
      if (state.status !== 'error') return state;
      return {
        ...state,
        status: 'idle',
        error: null,
        pendingAudioUri: null,
        retryDraft: null,
      };

    case 'RETRY': {
      if (state.status !== 'error') return state;
      // Translate-stage retry is preferred when available — the transcription
      // already exists so we skip a Whisper round-trip.
      if (state.retryDraft) {
        return {
          ...state,
          status: 'translating',
          error: null,
          draft: state.retryDraft,
          retryDraft: null,
        };
      }
      if (state.pendingAudioUri) {
        return { ...state, status: 'transcribing', error: null };
      }
      return state;
    }

    case 'NEW_SESSION':
    case 'LOAD_SESSION':
      return {
        status: 'idle',
        session: action.session,
        draft: null,
        error: null,
        pendingAudioUri: null,
        retryDraft: null,
      };

    default:
      return state;
  }
}
