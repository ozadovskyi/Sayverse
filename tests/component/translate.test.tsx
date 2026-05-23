import { fireEvent, screen } from '@testing-library/react-native';

import { testIDs } from '../../constants/testIDs';
import {
  clearStorage,
  mockAuthError,
  mockSignedIn,
  mockTranslation,
  mockTranslationError,
  renderApp,
} from './support/render';

/**
 * Type into the typed-text field and submit it. The app boots into
 * Conversation mode by default (post-2026-05-24 redesign), so the helper
 * first opts into Quick translate (single-shot) mode, then taps the `Type`
 * toggle to mount the typed input.
 */
function translateTyped(text: string) {
  fireEvent.press(screen.getByTestId(testIDs.mode.singleShot));
  fireEvent.press(screen.getByTestId(testIDs.textInput.toggleToTyped));
  fireEvent.changeText(screen.getByTestId(testIDs.textInput.field), text);
  fireEvent.press(screen.getByTestId(testIDs.textInput.translateButton));
}

describe('Typed-text translation', () => {
  beforeEach(async () => {
    await clearStorage();
    mockSignedIn();
  });

  it('translates typed text and shows both panels', async () => {
    mockTranslation('Привет, мир');
    renderApp();
    await screen.findByTestId(testIDs.record.button);

    translateTyped('Hola mundo');

    expect(
      await screen.findByTestId(testIDs.translation.translatedText),
    ).toHaveTextContent('Привет, мир');
    expect(screen.getByTestId(testIDs.translation.originalText)).toHaveTextContent(
      'Hola mundo',
    );
    // The field empties once the text is committed, so the next entry starts
    // fresh — asserting the result appeared is not enough, the post-action UI
    // state matters too.
    expect(screen.getByTestId(testIDs.textInput.field)).toHaveDisplayValue('');
  });

  it('auto-detects the language and routes the direction', async () => {
    // The picker defaults to Spanish→Russian. Detection reports the input is
    // Russian, so the translation must route Russian→Spanish instead.
    mockTranslation('Hola', 'ru');
    renderApp();
    await screen.findByTestId(testIDs.record.button);

    translateTyped('Привет');

    expect(
      await screen.findByTestId(testIDs.translation.translatedText),
    ).toHaveTextContent('Hola');
    // The result card labels the source panel Russian and the target Spanish.
    expect(
      screen.getByTestId(`${testIDs.translation.card}-original`),
    ).toHaveTextContent(/Russian/);
    expect(
      screen.getByTestId(`${testIDs.translation.card}-translated`),
    ).toHaveTextContent(/Spanish/);
  });

  it('toggles between voice and typed input modes', async () => {
    renderApp();
    // App boots into conversation; opt into Quick translate first so the
    // voice / typed sub-toggle is on screen.
    await screen.findByTestId(testIDs.mode.singleShot);
    fireEvent.press(screen.getByTestId(testIDs.mode.singleShot));
    // Default within Quick translate is voice — record button + Type toggle,
    // no text input.
    expect(await screen.findByTestId(testIDs.record.button)).toBeOnTheScreen();
    expect(screen.getByTestId(testIDs.textInput.toggleToTyped)).toBeOnTheScreen();
    expect(screen.queryByTestId(testIDs.textInput.field)).toBeNull();

    // Type toggle → text input mounts, record button unmounts.
    fireEvent.press(screen.getByTestId(testIDs.textInput.toggleToTyped));
    expect(await screen.findByTestId(testIDs.textInput.field)).toBeOnTheScreen();
    expect(screen.getByTestId(testIDs.textInput.translateButton)).toBeOnTheScreen();
    expect(screen.queryByTestId(testIDs.record.button)).toBeNull();

    // Voice toggle takes us back; the input unmounts again.
    fireEvent.press(screen.getByTestId(testIDs.textInput.toggleToVoice));
    expect(await screen.findByTestId(testIDs.record.button)).toBeOnTheScreen();
    expect(screen.queryByTestId(testIDs.textInput.field)).toBeNull();
  });

  it('surfaces an error when the API call fails', async () => {
    mockTranslationError();
    renderApp();
    await screen.findByTestId(testIDs.record.button);

    translateTyped('Hola mundo');

    expect(await screen.findByTestId(testIDs.translation.errorText)).toBeOnTheScreen();
    expect(screen.queryByTestId(testIDs.translation.translatedText)).toBeNull();
  });

  it('surfaces the specific auth message when the API key is rejected', async () => {
    // An expired / revoked key returns 401 from the OpenAI API → an `Auth`
    // AppError → its message must reach the user verbatim so they know to
    // re-enter their key in Settings.
    mockAuthError();
    renderApp();
    await screen.findByTestId(testIDs.record.button);

    translateTyped('Hola mundo');

    expect(
      await screen.findByTestId(testIDs.translation.errorText),
    ).toHaveTextContent(/Invalid or expired API key/i);
  });
});
