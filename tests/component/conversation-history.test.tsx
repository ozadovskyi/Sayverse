import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ConversationSession } from '../../constants/conversation';
import { testIDs } from '../../constants/testIDs';
import { clearStorage, mockSignedIn, renderApp, seedSessions } from './support/render';

// Conversation history is persisted in AsyncStorage. The voice flow that
// would normally create sessions needs a microphone, so these tests seed
// sessions directly and verify the restore-on-enter behaviour and the
// History browser — exactly as conversationStorage writes and reads them.

/** An es→ru session with one turn. */
const esru: ConversationSession = {
  id: 'seed-esru',
  langA: 'es',
  langB: 'ru',
  createdAt: 1000,
  updatedAt: 2000,
  turns: [
    {
      id: 'turn-esru-1',
      sourceLang: 'es',
      targetLang: 'ru',
      originalText: 'Hola desde el historial',
      translatedText: 'Привет из истории',
      createdAt: 1500,
    },
  ],
};

/** An en→fr session with one turn — a different pair, more recently updated. */
const enfr: ConversationSession = {
  id: 'seed-enfr',
  langA: 'en',
  langB: 'fr',
  createdAt: 2500,
  updatedAt: 3000,
  turns: [
    {
      id: 'turn-enfr-1',
      sourceLang: 'en',
      targetLang: 'fr',
      originalText: 'Hello from history',
      translatedText: 'Bonjour depuis l’historique',
      createdAt: 2700,
    },
  ],
};

describe('Conversation history', () => {
  beforeEach(async () => {
    await clearStorage();
    mockSignedIn();
  });

  it('entering conversation mode resumes the latest session for the pair', async () => {
    // The default pair is es→ru, so the es→ru session should be restored —
    // not the more recently updated en→fr one.
    await seedSessions([enfr, esru]);
    renderApp();

    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));

    expect(
      await screen.findByTestId(testIDs.conversation.turn('turn-esru-1')),
    ).toBeOnTheScreen();
    expect(screen.getByText('Hola desde el historial')).toBeOnTheScreen();
  });

  it('the History browser lists, restores, and deletes sessions', async () => {
    await seedSessions([enfr, esru]);
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));
    await screen.findByTestId(testIDs.conversation.view);

    // Open History — both saved sessions are listed.
    fireEvent.press(screen.getByTestId(testIDs.conversation.historyButton));
    expect(
      await screen.findByTestId(testIDs.conversation.historyModal),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(testIDs.conversation.session('seed-esru')),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(testIDs.conversation.session('seed-enfr')),
    ).toBeOnTheScreen();

    // Selecting the en→fr session restores it and closes the modal.
    fireEvent.press(screen.getByTestId(testIDs.conversation.session('seed-enfr')));
    await waitFor(() =>
      expect(screen.queryByTestId(testIDs.conversation.historyModal)).toBeNull(),
    );
    expect(
      await screen.findByTestId(testIDs.conversation.turn('turn-enfr-1')),
    ).toBeOnTheScreen();

    // Deleting a session removes it from the list; the other one stays.
    fireEvent.press(screen.getByTestId(testIDs.conversation.historyButton));
    const deleteEsru = await screen.findByTestId(
      testIDs.conversation.sessionDeleteButton('seed-esru'),
    );
    // The delete button fires an async storage write + list refresh — act
    // flushes that work (and the React state updates it triggers).
    await act(async () => {
      fireEvent.press(deleteEsru);
    });

    expect(
      screen.queryByTestId(testIDs.conversation.session('seed-esru')),
    ).toBeNull();
    expect(
      screen.getByTestId(testIDs.conversation.session('seed-enfr')),
    ).toBeOnTheScreen();
  });
});
