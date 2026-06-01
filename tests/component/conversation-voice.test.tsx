import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { testIDs } from '../../constants/testIDs';
import * as audio from '../../services/audio';
import { AppError, AppErrorType } from '../../services/errors';
import * as openai from '../../services/openai';
import * as translation from '../../services/translation';
import { clearStorage, mockSignedIn, renderApp } from './support/render';

// These tests drive the *whole* conversation voice flow through the
// transcription seam — start recording → stop → bilingual Whisper →
// translate → turn lands in the dialogue thread.
//
// They exist because a regression slipped past the previous component
// suite: short Spanish clips made Whisper drift to English on the
// unhinted call, the silent routing fallback then committed the turn as
// `Russian → Spanish`, and GPT was asked to translate already-Spanish
// text into Spanish — echoing it verbatim. The earlier tests seeded
// finished sessions and never exercised the transcription→routing wire,
// so the bug was invisible until on-device testing.
//
// What we mock and where the seam is:
//   - `audio` (recording side) → fake URIs, no real microphone;
//   - `translation.transcribeBilingual` → the bilingual function as a whole
//     (its parallel-Whisper selection logic is unit-tested separately);
//   - `openai.translateTextStreaming` → returns the translated text;
//   - everything else is the real assembled `<App />`.

const SPANISH_TEXT = 'Hola, muchas gracias, señor. Adiós.';
const RUSSIAN_TRANSLATION = 'Привет, большое спасибо, сеньор. До свидания.';

const RUSSIAN_TEXT = 'Привет, как у тебя дела?';
const SPANISH_TRANSLATION = '¿Hola, cómo estás hoy?';

function mockBilingualResult(opts: { text: string; detectedCode: 'es' | 'ru' }) {
  jest.mocked(translation.transcribeBilingual).mockResolvedValue({
    text: opts.text,
    detectedCode: opts.detectedCode,
  });
}

function mockTranslation(translated: string) {
  jest
    .mocked(openai.translateTextStreaming)
    .mockImplementation(async (_text, _src, _tgt, onProgress) => {
      onProgress(translated);
      return translated;
    });
}

/** Tap record (start), wait for the recording side-effect, tap record (stop). */
async function recordOneTurn() {
  const button = screen.getByTestId(testIDs.record.button);
  fireEvent.press(button);
  // `audio.startRecording` is the side-effect the second tap depends on —
  // without it the second tap would re-fire `beginRecording` rather than
  // `endRecording`. Once startRecording has been invoked the reducer has
  // dispatched START_RECORDING.
  await waitFor(() => expect(audio.startRecording).toHaveBeenCalled());
  // The stop press kicks off the whole async pipeline
  // (transcribe → translate → commit). Wrap in `act` so the React state
  // updates from those awaited steps are flushed before assertions —
  // without it the test renderer logs noisy "update inside act(...)"
  // warnings even when the assertions still pass.
  await act(async () => {
    fireEvent.press(button);
  });
}

describe('Conversation voice flow — bilingual transcription', () => {
  beforeEach(async () => {
    await clearStorage();
    await mockSignedIn();
    // Reset the call history (not the default implementation) of the
    // service mocks the tests assert on so each test starts with a clean
    // slate. The default implementations from `setup.ts` remain in place.
    jest.mocked(audio.startRecording).mockClear();
    jest.mocked(audio.stopRecording).mockClear();
    jest.mocked(audio.stopRecording).mockResolvedValue('file://fixture.m4a');
    jest.mocked(translation.transcribeBilingual).mockClear();
    jest.mocked(openai.translateTextStreaming).mockClear();
  });

  it('routes a Spanish utterance as Spanish→Russian (the bug scenario, fixed)', async () => {
    // The default pair is es↔ru. A Spanish utterance must commit the turn
    // labelled `Spanish → Russian` — *not* the inverted direction that
    // unhinted Whisper auto-detection used to produce on short clips.
    mockBilingualResult({ text: SPANISH_TEXT, detectedCode: 'es' });
    mockTranslation(RUSSIAN_TRANSLATION);

    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));
    await screen.findByTestId(testIDs.conversation.view);

    await recordOneTurn();

    // Wait for the committed turn — `conversation-turn-<id>` where id is
    // generated, so we find by the actual transcribed text first.
    await screen.findByText(SPANISH_TEXT);
    // The turn's bubble contains both halves with the correct labels.
    const bubble = screen.getByText(SPANISH_TEXT).parent!.parent!;
    expect(within(bubble as never).getByText('Spanish')).toBeOnTheScreen();
    expect(within(bubble as never).getByText('Russian')).toBeOnTheScreen();
    expect(within(bubble as never).getByText(RUSSIAN_TRANSLATION)).toBeOnTheScreen();

    // Whisper was driven through the bilingual fan-out, not the unhinted
    // path. This is the regression guard: if a future refactor reverts
    // conversation mode to a single unhinted Whisper call,
    // `transcribeBilingual` won't be hit and the test will fail loudly.
    expect(translation.transcribeBilingual).toHaveBeenCalledWith(
      'file://fixture.m4a',
      'es',
      'ru',
    );
  });

  it('routes a Russian utterance as Russian→Spanish (the symmetric case)', async () => {
    mockBilingualResult({ text: RUSSIAN_TEXT, detectedCode: 'ru' });
    mockTranslation(SPANISH_TRANSLATION);

    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));
    await screen.findByTestId(testIDs.conversation.view);

    await recordOneTurn();

    await screen.findByText(RUSSIAN_TEXT);
    const bubble = screen.getByText(RUSSIAN_TEXT).parent!.parent!;
    expect(within(bubble as never).getByText('Russian')).toBeOnTheScreen();
    expect(within(bubble as never).getByText('Spanish')).toBeOnTheScreen();
    expect(within(bubble as never).getByText(SPANISH_TRANSLATION)).toBeOnTheScreen();
  });

  it('surfaces a clear "couldn\'t tell" error when bilingual detection is ambiguous', async () => {
    // `transcribeBilingual` rejects with NoSpeech when both parallel
    // calls land below the hallucination floor — the new fail-loud path
    // that replaces the silent fallback. The user sees the error and can
    // retry, instead of getting a turn mistranslated in the wrong direction.
    jest
      .mocked(translation.transcribeBilingual)
      .mockRejectedValue(
        new AppError(
          AppErrorType.NoSpeech,
          "Couldn't tell which language you spoke — try a slightly longer phrase.",
        ),
      );

    renderApp();
    fireEvent.press(await screen.findByTestId(testIDs.mode.conversation));
    await screen.findByTestId(testIDs.conversation.view);

    await recordOneTurn();

    expect(await screen.findByText(/Couldn't tell which language/i)).toBeOnTheScreen();
    // No turn was committed — the dialogue thread is still empty.
    expect(screen.queryByText(SPANISH_TEXT)).toBeNull();
    expect(screen.queryByText(RUSSIAN_TEXT)).toBeNull();
    // The translator was never asked to translate garbage.
    expect(openai.translateTextStreaming).not.toHaveBeenCalled();
  });
});
