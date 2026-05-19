import { createSession, type ConversationSession } from '../constants/conversation';
import {
  conversationReducer,
  initialConversationState,
  type ConversationAction,
  type ConversationState,
  type TurnDraft,
} from './conversationReducer';

const SESSION: ConversationSession = createSession('s1', 'es', 'ru', 1000);
const DRAFT: TurnDraft = {
  id: 't1',
  sourceLang: 'es',
  targetLang: 'ru',
  originalText: 'Hola',
  createdAt: 2000,
};

/** Apply a sequence of actions starting from a fresh session. */
function reduce(...actions: ConversationAction[]): ConversationState {
  return actions.reduce(conversationReducer, initialConversationState(SESSION));
}

describe('initialConversationState', () => {
  it('starts idle with the given session and no draft or error', () => {
    const state = initialConversationState(SESSION);
    expect(state.status).toBe('idle');
    expect(state.session).toBe(SESSION);
    expect(state.draft).toBeNull();
    expect(state.error).toBeNull();
  });
});

describe('the happy-path turn lifecycle', () => {
  it('idle → recording → transcribing → translating → speaking → idle', () => {
    let state = reduce({ type: 'START_RECORDING' });
    expect(state.status).toBe('recording');

    state = conversationReducer(state, { type: 'RECORDING_STOPPED' });
    expect(state.status).toBe('transcribing');

    state = conversationReducer(state, { type: 'TRANSCRIBED', draft: DRAFT });
    expect(state.status).toBe('translating');
    expect(state.draft).toEqual(DRAFT);

    state = conversationReducer(state, { type: 'TRANSLATED', translatedText: 'Привет' });
    expect(state.status).toBe('speaking');
    expect(state.draft).toBeNull();

    state = conversationReducer(state, { type: 'SPEAKING_DONE' });
    expect(state.status).toBe('idle');
  });

  it('appends a fully-formed turn to the session on TRANSLATED', () => {
    const state = reduce(
      { type: 'START_RECORDING' },
      { type: 'RECORDING_STOPPED' },
      { type: 'TRANSCRIBED', draft: DRAFT },
      { type: 'TRANSLATED', translatedText: 'Привет' },
    );
    expect(state.session.turns).toEqual([
      {
        id: 't1',
        sourceLang: 'es',
        targetLang: 'ru',
        originalText: 'Hola',
        translatedText: 'Привет',
        createdAt: 2000,
      },
    ]);
    expect(state.session.updatedAt).toBe(2000);
  });

  it('does not mutate the previous session object', () => {
    const before = initialConversationState(SESSION);
    reduce(
      { type: 'START_RECORDING' },
      { type: 'RECORDING_STOPPED' },
      { type: 'TRANSCRIBED', draft: DRAFT },
      { type: 'TRANSLATED', translatedText: 'Привет' },
    );
    expect(before.session.turns).toEqual([]);
    expect(SESSION.turns).toEqual([]);
  });
});

describe('error handling — reachable from every step', () => {
  const reachedStatuses: { name: string; actions: ConversationAction[] }[] = [
    { name: 'recording', actions: [{ type: 'START_RECORDING' }] },
    {
      name: 'transcribing',
      actions: [{ type: 'START_RECORDING' }, { type: 'RECORDING_STOPPED' }],
    },
    {
      name: 'translating',
      actions: [
        { type: 'START_RECORDING' },
        { type: 'RECORDING_STOPPED' },
        { type: 'TRANSCRIBED', draft: DRAFT },
      ],
    },
    {
      name: 'speaking',
      actions: [
        { type: 'START_RECORDING' },
        { type: 'RECORDING_STOPPED' },
        { type: 'TRANSCRIBED', draft: DRAFT },
        { type: 'TRANSLATED', translatedText: 'Привет' },
      ],
    },
  ];

  for (const { name, actions } of reachedStatuses) {
    it(`ERROR from ${name} → error, with the message and no draft`, () => {
      const state = conversationReducer(reduce(...actions), {
        type: 'ERROR',
        message: 'network down',
      });
      expect(state.status).toBe('error');
      expect(state.error).toBe('network down');
      expect(state.draft).toBeNull();
    });
  }

  it('an error during speaking keeps the already-committed turn', () => {
    const state = conversationReducer(
      reduce(
        { type: 'START_RECORDING' },
        { type: 'RECORDING_STOPPED' },
        { type: 'TRANSCRIBED', draft: DRAFT },
        { type: 'TRANSLATED', translatedText: 'Привет' },
      ),
      { type: 'ERROR', message: 'tts failed' },
    );
    expect(state.status).toBe('error');
    expect(state.session.turns).toHaveLength(1);
  });

  it('DISMISS_ERROR returns to idle', () => {
    const state = conversationReducer(
      reduce({ type: 'START_RECORDING' }, { type: 'ERROR', message: 'x' }),
      { type: 'DISMISS_ERROR' },
    );
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });

  it('recovers — START_RECORDING is accepted from the error state', () => {
    const state = conversationReducer(
      reduce({ type: 'START_RECORDING' }, { type: 'ERROR', message: 'x' }),
      { type: 'START_RECORDING' },
    );
    expect(state.status).toBe('recording');
    expect(state.error).toBeNull();
  });
});

describe('out-of-order actions are ignored', () => {
  it('ignores RECORDING_STOPPED while idle (returns the same state)', () => {
    const idle = initialConversationState(SESSION);
    expect(conversationReducer(idle, { type: 'RECORDING_STOPPED' })).toBe(idle);
  });

  it('ignores START_RECORDING while already recording', () => {
    const recording = reduce({ type: 'START_RECORDING' });
    expect(conversationReducer(recording, { type: 'START_RECORDING' })).toBe(recording);
  });

  it('ignores TRANSLATED while transcribing', () => {
    const transcribing = reduce(
      { type: 'START_RECORDING' },
      { type: 'RECORDING_STOPPED' },
    );
    expect(
      conversationReducer(transcribing, { type: 'TRANSLATED', translatedText: 'x' }),
    ).toBe(transcribing);
  });

  it('ignores SPEAKING_DONE while idle', () => {
    const idle = initialConversationState(SESSION);
    expect(conversationReducer(idle, { type: 'SPEAKING_DONE' })).toBe(idle);
  });

  it('ignores DISMISS_ERROR when there is no error', () => {
    const idle = initialConversationState(SESSION);
    expect(conversationReducer(idle, { type: 'DISMISS_ERROR' })).toBe(idle);
  });
});

describe('session switching', () => {
  it('NEW_SESSION replaces the session and resets to idle', () => {
    const fresh = createSession('s2', 'en', 'ru', 5000);
    const state = conversationReducer(
      reduce({ type: 'START_RECORDING' }, { type: 'ERROR', message: 'x' }),
      { type: 'NEW_SESSION', session: fresh },
    );
    expect(state.status).toBe('idle');
    expect(state.session).toBe(fresh);
    expect(state.error).toBeNull();
    expect(state.draft).toBeNull();
  });

  it('LOAD_SESSION restores a session with existing turns', () => {
    const loaded: ConversationSession = {
      ...createSession('s3', 'es', 'en', 100),
      turns: [
        {
          id: 'old',
          sourceLang: 'es',
          targetLang: 'en',
          originalText: 'Hola',
          translatedText: 'Hello',
          createdAt: 200,
        },
      ],
    };
    const state = conversationReducer(initialConversationState(SESSION), {
      type: 'LOAD_SESSION',
      session: loaded,
    });
    expect(state.status).toBe('idle');
    expect(state.session.turns).toHaveLength(1);
  });
});
