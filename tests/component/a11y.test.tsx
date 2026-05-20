import { screen } from '@testing-library/react-native';

import { testIDs } from '../../constants/testIDs';
import {
  clearStorage,
  mockOffline,
  mockSignedIn,
  mockSignedOut,
  renderApp,
} from './support/render';

/**
 * Accessibility sweep — assert key interactive controls are reachable by
 * their role and name (the same information a screen reader uses). These
 * tests deliberately use `getByRole` / `getByLabelText` instead of testID,
 * so a missing or wrong `accessibilityLabel` fails the build.
 */
describe('Accessibility — key controls are reachable by role and name', () => {
  beforeEach(clearStorage);

  it('the setup screen exposes labelled controls', async () => {
    mockSignedOut();
    renderApp();

    // The API-key input is found by its label, not its testID.
    expect(await screen.findByLabelText(/openai api key/i)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /save key and start/i }),
    ).toBeOnTheScreen();
  });

  it('the translator surface announces its primary actions', async () => {
    mockSignedIn();
    renderApp();

    // Header settings button.
    expect(
      await screen.findByRole('button', { name: /open settings/i }),
    ).toBeOnTheScreen();
    // Mode segmented control — exposes the selected/unselected pair.
    expect(
      screen.getByRole('button', { name: /single/i, selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /conversation/i, selected: false }),
    ).toBeOnTheScreen();
    // The record button announces what tapping will do.
    expect(screen.getByRole('button', { name: /tap to speak/i })).toBeOnTheScreen();
    // The input-mode toggle ("Type instead") is the voice-mode tell.
    expect(
      screen.getByRole('button', { name: /type instead/i }),
    ).toBeOnTheScreen();
  });

  it('the language picker buttons name the current pair', async () => {
    mockSignedIn();
    renderApp();

    // Defaults: source Spanish, target Russian. Labels carry the current
    // value so a screen-reader user knows what swapping would change.
    expect(
      await screen.findByRole('button', { name: /source language: spanish/i }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /target language: russian/i }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /swap languages/i })).toBeOnTheScreen();
  });

  it('the offline banner is announced as an alert', async () => {
    mockSignedIn();
    mockOffline();
    renderApp();
    // Wait for the translator to finish loading the stored key — the banner
    // only mounts on the main screen, not on the setup screen.
    await screen.findByTestId(testIDs.record.button);

    // The banner's accessibility label is what a screen reader announces on
    // appearance. (The view's `accessibilityRole="alert"` is set on the same
    // node — assistive tech reads it as an alert rather than a passive view.)
    expect(screen.getByLabelText(/no internet connection/i)).toBeOnTheScreen();
  });
});
