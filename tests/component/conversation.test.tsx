import { fireEvent, screen } from '@testing-library/react-native';

import { testIDs } from '../../constants/testIDs';
import { clearStorage, mockSignedIn, renderApp } from './support/render';

// The conversation voice flow needs a microphone — that path is covered by
// the Maestro native layer. These tests cover the web/component-testable
// part: the mode switch and the dialogue view rendering.
describe('Conversation mode', () => {
  beforeEach(async () => {
    await clearStorage();
    mockSignedIn();
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

    expect(await screen.findByTestId(testIDs.textInput.field)).toBeOnTheScreen();
  });
});
