import { fireEvent, screen } from '@testing-library/react-native';

import { testIDs } from '../../constants/testIDs';
import { clearStorage, mockSignedIn, renderApp } from './support/render';

describe('Settings', () => {
  beforeEach(async () => {
    await clearStorage();
    mockSignedIn();
  });

  it('opens the settings sheet', async () => {
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.header.settingsButton));

    expect(await screen.findByTestId(testIDs.settings.screen)).toBeOnTheScreen();
  });

  it('resetting the API key returns to the setup screen', async () => {
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.header.settingsButton));
    fireEvent.press(await screen.findByTestId(testIDs.settings.logoutButton));

    expect(await screen.findByTestId(testIDs.setup.screen)).toBeOnTheScreen();
  });

  it('a fresh key entered after Reset advances back to the translator', async () => {
    // The expired-key recovery path: an auth failure does not kick the user
    // out automatically — they recover via Settings → Reset → re-enter.
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.header.settingsButton));
    fireEvent.press(await screen.findByTestId(testIDs.settings.logoutButton));
    await screen.findByTestId(testIDs.setup.screen);

    fireEvent.changeText(
      await screen.findByTestId(testIDs.setup.apiKeyInput),
      'sk-fresh-key',
    );
    fireEvent.press(screen.getByTestId(testIDs.setup.saveButton));

    expect(await screen.findByTestId(testIDs.record.button)).toBeOnTheScreen();
  });

  it('speak-aloud is off by default and toggles on', async () => {
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.header.settingsButton));

    const toggle = await screen.findByTestId(testIDs.settings.speakAloudToggle);
    // Speech is opt-in — a fresh install starts with it off.
    expect(toggle).toHaveTextContent(/Off/);

    fireEvent.press(toggle);
    expect(await screen.findByTestId(testIDs.settings.speakAloudToggle)).toHaveTextContent(
      /On/,
    );
  });

  it('the speak-aloud preference persists across a remount', async () => {
    const first = renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.header.settingsButton));
    fireEvent.press(await screen.findByTestId(testIDs.settings.speakAloudToggle));
    await screen.findByText(/On/);
    first.unmount();

    // A fresh mount reads the persisted preference back from storage.
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.header.settingsButton));
    expect(await screen.findByTestId(testIDs.settings.speakAloudToggle)).toHaveTextContent(
      /On/,
    );
  });
});
