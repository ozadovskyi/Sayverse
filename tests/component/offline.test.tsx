import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { testIDs } from '../../constants/testIDs';
import * as openai from '../../services/openai';
import { clearStorage, mockOffline, mockSignedIn, renderApp } from './support/render';

// The app has a `useNetworkStatus` hook + `OfflineBanner` + `guardOnline`
// gate, but until now nothing asserted any of that — the global mock forced
// every component test to "online". These flip the mock to offline and check
// the user-visible consequences.
describe('Offline behaviour', () => {
  beforeEach(async () => {
    await clearStorage();
    mockSignedIn();
  });

  it('shows the offline banner when the network is unreachable', async () => {
    mockOffline();
    renderApp();

    expect(await screen.findByTestId(testIDs.offlineBanner)).toBeOnTheScreen();
  });

  it('blocks a typed translation while offline and never hits the API', async () => {
    mockOffline();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderApp();
    await screen.findByTestId(testIDs.record.button);

    // Switch into typed mode, enter text, press Go.
    fireEvent.press(screen.getByTestId(testIDs.textInput.toggleToTyped));
    fireEvent.changeText(
      await screen.findByTestId(testIDs.textInput.field),
      'Hola',
    );
    fireEvent.press(screen.getByTestId(testIDs.textInput.translateButton));

    // The user sees a "No connection" alert and the network is never called.
    expect(alertSpy).toHaveBeenCalledWith(
      'No connection',
      expect.stringContaining('Internet'),
    );
    expect(openai.detectLanguage).not.toHaveBeenCalled();
    expect(openai.translateText).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
