import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { testIDs } from '../../constants/testIDs';
import { clearStorage, mockSignedIn, mockSignedOut, renderApp } from './support/render';

describe('First-run setup', () => {
  beforeEach(clearStorage);

  it('shows the API-key setup screen when no key is stored', async () => {
    await mockSignedOut();
    const { findByTestId } = renderApp();

    expect(await findByTestId(testIDs.setup.screen)).toBeOnTheScreen();
    expect(await findByTestId(testIDs.setup.apiKeyInput)).toBeOnTheScreen();
    expect(await findByTestId(testIDs.setup.saveButton)).toBeOnTheScreen();
  });

  it('a valid key advances straight to the translator (consent already given)', async () => {
    // mockSignedOut seeds consent=true by default — once the consent
    // gate is past, saving a valid key lands on the main screen with
    // no further interstitials.
    await mockSignedOut();
    const { findByTestId, getByTestId } = renderApp();

    fireEvent.changeText(
      await findByTestId(testIDs.setup.apiKeyInput),
      'sk-test-key-123',
    );
    fireEvent.press(getByTestId(testIDs.setup.saveButton));

    expect(await findByTestId(testIDs.record.button)).toBeOnTheScreen();
  });

  it('boots straight to the translator when a key and consent are stored', async () => {
    await mockSignedIn();
    const { findByTestId } = renderApp();

    expect(await findByTestId(testIDs.record.button)).toBeOnTheScreen();
  });

  it('fresh install shows the consent gate before the setup screen', async () => {
    // Front-loaded per Apple 5.1.2(i) / EU AI Act Art. 50: consent must
    // precede any UI that could lead to a transmission, including the
    // API-key entry.
    await mockSignedOut({ consent: false });
    const { findByTestId, queryByTestId } = renderApp();

    expect(await findByTestId(testIDs.consent.screen)).toBeOnTheScreen();
    expect(queryByTestId(testIDs.setup.screen)).toBeNull();

    fireEvent.press(await findByTestId(testIDs.consent.agreeButton));

    expect(await findByTestId(testIDs.setup.screen)).toBeOnTheScreen();
  });

  it('Decline at the consent gate soft-blocks with an alert and stays', async () => {
    // Now that consent is front-loaded, Decline cannot tear down a
    // session — there is none yet. iOS HIG forbids programmatic exit,
    // so the contract is: a non-cancelable alert explains the block,
    // and the user remains on the consent screen with Agree still
    // available. No state mutates.
    await mockSignedOut({ consent: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { findByTestId, queryByTestId } = renderApp();

    fireEvent.press(await findByTestId(testIDs.consent.declineButton));

    expect(alertSpy).toHaveBeenCalledWith(
      'Consent required',
      expect.stringContaining('cannot transcribe or translate'),
      [{ text: 'OK' }],
      expect.objectContaining({ cancelable: false }),
    );

    // Still on the consent screen — no transition to setup or main.
    expect(await findByTestId(testIDs.consent.screen)).toBeOnTheScreen();
    expect(queryByTestId(testIDs.setup.screen)).toBeNull();
    expect(queryByTestId(testIDs.record.button)).toBeNull();

    alertSpy.mockRestore();
  });

  it('rejects a key that does not match the OpenAI prefix', async () => {
    // Every real OpenAI key starts with `sk-`; anything else is a paste
    // mistake. The app warns the user instead of saving and advancing.
    await mockSignedOut();
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
