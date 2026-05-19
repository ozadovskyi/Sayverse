import { fireEvent } from '@testing-library/react-native';

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
});
