import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { testIDs } from '../../constants/testIDs';
import * as audio from '../../services/audio';
import * as translation from '../../services/translation';
import { clearStorage, mockSignedIn, renderApp } from './support/render';

// Drives the Quick-translate (single-shot) VOICE flow through the silence
// gate — the sibling of `conversation-voice.test.tsx` for the other mode.
//
// Seam: `audio` (recording) is mocked so the test captures the `onLevel`
// callback `startRecording` is given and feeds it metering frames by hand;
// `translation.transcribeForTranslation` is the single-shot transcribe entry
// point — the gate must NOT call it on a silent clip.

/** Boot the app, switch to Quick-translate, and land on the voice record button. */
async function enterQuickTranslateVoice() {
  // The app boots into Conversation mode; the record button is present there
  // too, so wait for first render, opt into Quick translate, then settle on
  // its voice sub-mode (record button + Type toggle, no text field).
  await screen.findByTestId(testIDs.record.button);
  fireEvent.press(screen.getByTestId(testIDs.mode.singleShot));
  await screen.findByTestId(testIDs.record.button);
}

/**
 * Tap record, feed the VAD the given dBFS metering frames, then tap stop. On
 * device `services/audio` invokes the `onLevel` passed to `startRecording` on
 * every frame; here we capture that callback and drive it by hand to replay
 * "the mic heard only silence" (every frame below the −40 dBFS threshold).
 */
async function recordWithLevels(levels: number[]) {
  let onLevel: ((db: number) => void) | undefined;
  jest
    .mocked(audio.startRecording)
    .mockImplementation(async (cb?: (db: number) => void) => {
      onLevel = cb;
    });
  const button = screen.getByTestId(testIDs.record.button);
  fireEvent.press(button);
  await waitFor(() => expect(audio.startRecording).toHaveBeenCalled());
  await act(async () => {
    for (const db of levels) onLevel?.(db);
  });
  await act(async () => {
    fireEvent.press(button);
  });
}

describe('Quick-translate voice flow — silence gate', () => {
  beforeEach(async () => {
    await clearStorage();
    await mockSignedIn();
    jest.mocked(audio.startRecording).mockClear();
    jest.mocked(audio.stopRecording).mockClear();
    jest.mocked(audio.stopRecording).mockResolvedValue('file://fixture.m4a');
    jest.mocked(translation.transcribeForTranslation).mockClear();
  });

  it('does NOT send a silent clip to Whisper — only-silent metering, manual stop (BUG)', async () => {
    // Same on-device report as conversation mode, in single-shot: a clip the
    // mic scores as pure silence (every frame below −40 dBFS), stopped by a
    // tap, must be rejected as "no speech" WITHOUT a Whisper call — otherwise
    // Whisper hallucinates a deterministic canned phrase on the silence.
    //
    // Fails if the `handleRecordPress` silence gate in App.tsx is removed:
    // `transcribeForTranslation` is then called on the silent clip.
    renderApp();
    await enterQuickTranslateVoice();

    await recordWithLevels([-55, -58, -60, -57]);

    // The silent clip never reached Whisper …
    expect(translation.transcribeForTranslation).not.toHaveBeenCalled();
    // … the user is prompted to try again …
    expect(
      await screen.findByTestId(testIDs.translation.errorText),
    ).toHaveTextContent(/didn't catch that/i);
    // … and no translation result was rendered.
    expect(screen.queryByTestId(testIDs.translation.translatedText)).toBeNull();
  });
});
