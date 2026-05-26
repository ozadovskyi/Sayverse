import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { testIDs } from '../../constants/testIDs';
import { clearStorage, mockSignedIn, renderApp, seedSessions } from './support/render';

// The conversation voice flow needs a microphone — that path is covered by
// the Maestro native layer. These tests cover the web/component-testable
// part: the mode switch and the dialogue view rendering.
describe('Conversation mode', () => {
  beforeEach(async () => {
    await clearStorage();
    await mockSignedIn();
  });

  it('switching to conversation mode shows the dialogue view', async () => {
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));

    expect(await screen.findByTestId(testIDs.conversation.view)).toBeOnTheScreen();
    // The typed-text path belongs to single-shot mode only.
    expect(screen.queryByTestId(testIDs.textInput.field)).toBeNull();
  });

  it('switching back restores single-shot mode', async () => {
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));
    await screen.findByTestId(testIDs.conversation.view);
    fireEvent.press(screen.getByTestId(testIDs.mode.singleShot));

    // Single mode starts in voice — the `Type` toggle is its tell.
    expect(await screen.findByTestId(testIDs.textInput.toggleToTyped)).toBeOnTheScreen();
  });

  it('labels a turn with the actually-detected language when it differs', async () => {
    // An es↔ru conversation with two turns: one where the detected language
    // matches the routed slot, and one where a third language (English) was
    // spoken — routing fell back to es, but the card must show what was heard.
    await seedSessions([
      {
        id: 's1',
        langA: 'es',
        langB: 'ru',
        createdAt: 1000,
        updatedAt: 2000,
        turns: [
          {
            id: 'turn-clean',
            sourceLang: 'ru',
            targetLang: 'es',
            detectedLang: 'ru',
            originalText: 'Привет',
            translatedText: 'Hola',
            createdAt: 1500,
          },
          {
            id: 'turn-mismatch',
            sourceLang: 'es',
            targetLang: 'ru',
            detectedLang: 'en',
            originalText: 'What?',
            translatedText: 'Что?',
            createdAt: 1800,
          },
        ],
      },
    ]);
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));
    await screen.findByTestId(testIDs.conversation.view);

    // The mismatch turn surfaces what Whisper heard…
    const mismatch = await screen.findByTestId(testIDs.conversation.turn('turn-mismatch'));
    expect(within(mismatch).getByText(/heard English/i)).toBeOnTheScreen();
    // …while a turn whose detected language matches its slot shows no note.
    const clean = screen.getByTestId(testIDs.conversation.turn('turn-clean'));
    expect(within(clean).queryByText(/heard/i)).toBeNull();
  });

  it('New conversation starts a fresh session and keeps the previous in history', async () => {
    // Seed an es↔ru session with one turn so it auto-resumes on mode entry.
    await seedSessions([
      {
        id: 'seed',
        langA: 'es',
        langB: 'ru',
        createdAt: 1000,
        updatedAt: 2000,
        turns: [
          {
            id: 'turn-1',
            sourceLang: 'es',
            targetLang: 'ru',
            detectedLang: 'es',
            originalText: 'Hola',
            translatedText: 'Привет',
            createdAt: 1500,
          },
        ],
      },
    ]);
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));

    // Session resumed — the seeded turn is on screen.
    await screen.findByTestId(testIDs.conversation.turn('turn-1'));

    // Tap "New conversation". The bubble vanishes — the new session is empty.
    fireEvent.press(screen.getByTestId(testIDs.conversation.newSessionButton));
    await waitFor(() =>
      expect(screen.queryByTestId(testIDs.conversation.turn('turn-1'))).toBeNull(),
    );
    // Empty sessions do not render the "New conversation" button — its
    // disappearance is the proof the session is now blank.
    expect(screen.queryByTestId(testIDs.conversation.newSessionButton)).toBeNull();

    // The previous session is preserved — still listed in History.
    fireEvent.press(screen.getByTestId(testIDs.history.button));
    expect(
      await screen.findByTestId(testIDs.conversation.session('seed')),
    ).toBeOnTheScreen();
  });
});
