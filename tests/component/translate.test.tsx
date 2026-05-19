import { fireEvent, screen } from '@testing-library/react-native';

import { testIDs } from '../../constants/testIDs';
import {
  clearStorage,
  mockSignedIn,
  mockTranslation,
  mockTranslationError,
  renderApp,
} from './support/render';

/** Type into the typed-text field and submit it. */
function translateTyped(text: string) {
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

  it('reverses the translation direction on demand', async () => {
    // Detection defaults to Spanish, so the first pass routes Spanish→Russian.
    mockTranslation('resultado');
    renderApp();
    await screen.findByTestId(testIDs.record.button);

    translateTyped('hello');
    expect(
      await screen.findByTestId(`${testIDs.translation.card}-original`),
    ).toHaveTextContent(/Spanish/);

    // Tapping reverse re-translates the same text the other way.
    fireEvent.press(screen.getByTestId(testIDs.translation.reverseButton));

    expect(
      await screen.findByTestId(`${testIDs.translation.card}-original`),
    ).toHaveTextContent(/Russian/);
    expect(
      screen.getByTestId(`${testIDs.translation.card}-translated`),
    ).toHaveTextContent(/Spanish/);
  });

  it('surfaces an error when the API call fails', async () => {
    mockTranslationError();
    renderApp();
    await screen.findByTestId(testIDs.record.button);

    translateTyped('Hola mundo');

    expect(await screen.findByTestId(testIDs.translation.errorText)).toBeOnTheScreen();
    expect(screen.queryByTestId(testIDs.translation.translatedText)).toBeNull();
  });
});
