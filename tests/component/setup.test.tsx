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

  it('a valid key advances to the translator screen', async () => {
    mockSignedOut();
    const { findByTestId, getByTestId } = renderApp();

    fireEvent.changeText(
      await findByTestId(testIDs.setup.apiKeyInput),
      'sk-test-key-123',
    );
    fireEvent.press(getByTestId(testIDs.setup.saveButton));

    expect(await findByTestId(testIDs.record.button)).toBeOnTheScreen();
  });

  it('boots straight to the translator when a key is already stored', async () => {
    mockSignedIn();
    const { findByTestId } = renderApp();

    expect(await findByTestId(testIDs.record.button)).toBeOnTheScreen();
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
