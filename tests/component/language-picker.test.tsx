import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { testIDs } from '../../constants/testIDs';
import { clearStorage, mockSignedIn, renderApp } from './support/render';

describe('Language picker', () => {
  beforeEach(async () => {
    await clearStorage();
    await mockSignedIn();
  });

  it('changes the source language', async () => {
    renderApp();
    const sourceButton = await screen.findByTestId(testIDs.language.sourceButton);
    expect(sourceButton).toHaveTextContent(/Spanish/);

    fireEvent.press(sourceButton);
    fireEvent.press(await screen.findByTestId(testIDs.language.option('en')));

    expect(screen.getByTestId(testIDs.language.sourceButton)).toHaveTextContent(/English/);
    // Selecting an option must also close the picker — assert the resulting
    // UI state, not just that the label changed.
    await waitFor(() =>
      expect(screen.queryByTestId(testIDs.language.option('en'))).toBeNull(),
    );
  });

  it('swaps the source and target languages', async () => {
    renderApp();
    // Defaults: source Spanish, target Russian.
    fireEvent.press(await screen.findByTestId(testIDs.language.swapButton));

    expect(screen.getByTestId(testIDs.language.sourceButton)).toHaveTextContent(/Russian/);
    expect(screen.getByTestId(testIDs.language.targetButton)).toHaveTextContent(/Spanish/);
  });

  it('closes the picker with the Cancel button', async () => {
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.language.sourceButton));
    expect(await screen.findByTestId(testIDs.language.option('en'))).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId(testIDs.language.cancelButton));

    await waitFor(() =>
      expect(screen.queryByTestId(testIDs.language.option('en'))).toBeNull(),
    );
  });

  it('closes the picker by tapping the backdrop', async () => {
    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.language.sourceButton));
    expect(await screen.findByTestId(testIDs.language.option('en'))).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId(testIDs.language.modalBackdrop));

    await waitFor(() =>
      expect(screen.queryByTestId(testIDs.language.option('en'))).toBeNull(),
    );
  });
});
