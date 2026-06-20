import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ConversationSession } from '../../constants/conversation';
import { testIDs } from '../../constants/testIDs';
import * as conversationStorage from '../../storage/conversationStorage';
import { clearStorage, mockSignedIn, renderApp, seedSessions } from './support/render';

// Repro for the on-device report: open a non-top conversation from History,
// reopen History — the TOP one is highlighted instead of the one just opened.
//
// It never reproduces in the emulator or the other component tests because
// they read AsyncStorage fast. The boot effect fires `resumeOrStart`, which
// asynchronously loads "the latest session for the pair" (usually the top
// one) and dispatches LOAD_SESSION. On a slow device that read is still in
// flight when the user opens History and taps a session — so when it finally
// resolves it clobbers the user's pick with the top session.
//
// This test forces that timing by holding the FIRST `loadSessions` call (the
// boot resume) on a gate until after the user has selected a session.

function sess(id: string, updatedAt: number): ConversationSession {
  return {
    id,
    langA: 'es',
    langB: 'ru',
    createdAt: updatedAt,
    updatedAt,
    turns: [
      {
        id: `${id}-t`,
        sourceLang: 'es',
        targetLang: 'ru',
        originalText: id,
        translatedText: `${id}-x`,
        createdAt: updatedAt,
      },
    ],
  };
}

describe('History resume race', () => {
  beforeEach(async () => {
    await clearStorage();
    await mockSignedIn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('explicit History selection is not clobbered by a slow boot resume', async () => {
    await seedSessions([sess('top', 3000), sess('older', 2000)]);

    // Hold the first loadSessions call (the boot resume) until released.
    const real = conversationStorage.loadSessions;
    let releaseBoot: (() => void) | null = null;
    const bootGate = new Promise<void>(r => {
      releaseBoot = r;
    });
    let firstCall = true;
    jest.spyOn(conversationStorage, 'loadSessions').mockImplementation(async () => {
      if (firstCall) {
        firstCall = false;
        await bootGate; // boot resume stalls here, like slow device I/O
      }
      return real();
    });

    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));
    await screen.findByTestId(testIDs.conversation.view);

    // User opens History and taps the OLDER (non-top) session — all while the
    // boot resume is still parked on the gate.
    fireEvent.press(screen.getByTestId(testIDs.history.button));
    await screen.findByTestId(testIDs.conversation.historyModal);
    fireEvent.press(screen.getByTestId(testIDs.conversation.session('older')));
    await waitFor(() =>
      expect(screen.queryByTestId(testIDs.conversation.historyModal)).toBeNull(),
    );

    // Now the slow boot resume finally lands.
    releaseBoot!();
    await new Promise(r => setTimeout(r, 0));

    // Reopen History — the OLDER session must still be the current one.
    fireEvent.press(screen.getByTestId(testIDs.history.button));
    await screen.findByTestId(testIDs.conversation.historyModal);

    const older = screen.getByTestId(testIDs.conversation.session('older'));
    const top = screen.getByTestId(testIDs.conversation.session('top'));
    expect(older.props.accessibilityState).toMatchObject({ selected: true });
    expect(top.props.accessibilityState).toMatchObject({ selected: false });
  });
});
