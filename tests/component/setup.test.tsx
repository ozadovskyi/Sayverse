import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { testIDs } from '../../constants/testIDs';
import { clearStorage, mockSignedIn, mockSignedOut, renderApp } from './support/render';

describe('First-run setup', () => {
  beforeEach(clearStorage);

  it('shows the API-key setup screen when no key is stored', async () => {
    mockSignedOut();
    const { findByTestId } = renderApp();

    expect(await findByTestId(testIDs.setup.screen)).toBeOnTheScreen();
    expect(await findByTestId(testIDs.setup.apiKeyInput)).toBeOnTheScreen();
    expect(await findByTestId(testIDs.setup.saveButton)).toBeOnTheScreen();
  });

  it('a valid key advances to the consent gate, then the translator', async () => {
    mockSignedOut();
    const { findByTestId, getByTestId } = renderApp();

    fireEvent.changeText(
      await findByTestId(testIDs.setup.apiKeyInput),
      'sk-test-key-123',
    );
    fireEvent.press(getByTestId(testIDs.setup.saveButton));

    // Consent gate appears first (Apple 5.1.2(i) / GDPR 6(1)(a)).
    fireEvent.press(await findByTestId(testIDs.consent.agreeButton));

    expect(await findByTestId(testIDs.record.button)).toBeOnTheScreen();
  });

  it('boots straight to the translator when a key and consent are stored', async () => {
    await mockSignedIn();
    const { findByTestId } = renderApp();

    expect(await findByTestId(testIDs.record.button)).toBeOnTheScreen();
  });

  it('shows the consent gate when a key is stored but consent was not given', async () => {
    await mockSignedIn({ consent: false });
    const { findByTestId } = renderApp();

    expect(await findByTestId(testIDs.consent.screen)).toBeOnTheScreen();
    expect(await findByTestId(testIDs.consent.agreeButton)).toBeOnTheScreen();
    expect(await findByTestId(testIDs.consent.declineButton)).toBeOnTheScreen();
  });

  it('Decline at the consent gate explains and drops back to setup', async () => {
    // The alert is fired *before* the state changes so the modal mounts
    // on top of the still-present consent screen (a device-test finding —
    // showing the alert after teardown lets iOS swallow it during the
    // re-render). The test mirrors that contract: capture the alert, run
    // its OK handler, then assert the setup screen took over.
    await mockSignedIn({ consent: false });
    type AlertButton = { text?: string; onPress?: () => void | Promise<void> };
    let okHandler: (() => void | Promise<void>) | undefined;
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const ok = (buttons as AlertButton[] | undefined)?.find(
          b => b.text === 'OK',
        );
        okHandler = ok?.onPress;
      });
    const { findByTestId } = renderApp();

    fireEvent.press(await findByTestId(testIDs.consent.declineButton));

    expect(alertSpy).toHaveBeenCalledWith(
      'Consent declined',
      expect.stringContaining('cannot operate'),
      expect.any(Array),
      expect.objectContaining({ cancelable: false }),
    );

    await okHandler?.();

    expect(await findByTestId(testIDs.setup.screen)).toBeOnTheScreen();

    alertSpy.mockRestore();
  });

  it('rejects a key that does not match the OpenAI prefix', async () => {
    // Every real OpenAI key starts with `sk-`; anything else is a paste
    // mistake. The app warns the user instead of saving and advancing.
    mockSignedOut();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderApp();

    fireEvent.changeText(
      await screen.findByTestId(testIDs.setup.apiKeyInput),
      'not-a-real-key',
    );
    fireEvent.press(screen.getByTestId(testIDs.setup.saveButton));

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid key',
      expect.stringContaining('sk-'),
    );
    // The app stayed on the setup screen — the invalid key did not advance.
    expect(screen.getByTestId(testIDs.setup.screen)).toBeOnTheScreen();
    expect(screen.queryByTestId(testIDs.record.button)).toBeNull();

    alertSpy.mockRestore();
  });
});
