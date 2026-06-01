import { AppError, AppErrorType } from './errors';
import { transcribeAudio } from './openai';
import { transcribeBilingual, transcribeForTranslation } from './translation';

// Stub the OpenAI module so the transcription pipeline can be exercised in
// clean Node without an API key or a network call. Jest hoists `jest.mock`
// above the imports above, so `transcribeAudio` resolves to this stub.
jest.mock('./openai', () => ({ transcribeAudio: jest.fn() }));

const mockTranscribe = jest.mocked(transcribeAudio);

describe('transcribeForTranslation', () => {
  beforeEach(() => mockTranscribe.mockReset());

  it('returns trimmed text and the detected language', async () => {
    mockTranscribe.mockResolvedValue({
      text: '  Hola  ',
      language: 'spanish',
      avgLogprob: -0.3,
    });
    await expect(transcribeForTranslation('file://clip.m4a')).resolves.toEqual({
      text: 'Hola',
      detectedCode: 'spanish',
    });
  });

  it('throws when the recording is missing', async () => {
    await expect(transcribeForTranslation(null)).rejects.toBeInstanceOf(AppError);
    await expect(transcribeForTranslation(undefined)).rejects.toBeInstanceOf(AppError);
    // Whisper is never called when there is no recording.
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it('throws when the recording is silent (empty transcript)', async () => {
    // `transcribeAudio` returns an empty string for silent audio.
    mockTranscribe.mockResolvedValue({
      text: '   ',
      language: '',
      avgLogprob: -Infinity,
    });
    await expect(transcribeForTranslation('file://silence.m4a')).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

// Conversation mode runs Whisper twice in parallel, once hinted per pair
// language, and picks the call Whisper itself is more confident about.
// These cases come straight from real-device failures:
//  - English bias on short Spanish clips (the wrong-direction routing bug),
//  - one of the parallel calls returning empty / network-failing,
//  - both calls producing only low-confidence garbage.
describe('transcribeBilingual', () => {
  beforeEach(() => mockTranscribe.mockReset());

  /**
   * Drive `transcribeAudio` by the `languageHint` it was called with — this
   * is how Whisper actually behaves with a hint, and lets the test express
   * "hint=ru drifts to garbage on Spanish audio, hint=es transcribes
   * correctly with high confidence" as data.
   */
  function whenHintedReturn(byHint: Record<string, Awaited<ReturnType<typeof transcribeAudio>>>) {
    mockTranscribe.mockImplementation(async (_uri, hint) => {
      if (!hint || !byHint[hint]) {
        throw new Error(`test setup: no fixture for hint ${hint}`);
      }
      return byHint[hint];
    });
  }

  it('throws when there is no recording (mirrors transcribeForTranslation)', async () => {
    await expect(transcribeBilingual(null, 'es', 'ru')).rejects.toBeInstanceOf(AppError);
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it('fans out two hinted Whisper calls in parallel — one per pair language', async () => {
    whenHintedReturn({
      es: { text: 'Hola', language: 'spanish', avgLogprob: -0.2 },
      ru: { text: 'Хола', language: 'russian', avgLogprob: -0.9 },
    });
    await transcribeBilingual('file://clip.m4a', 'es', 'ru');
    expect(mockTranscribe).toHaveBeenCalledTimes(2);
    const hints = mockTranscribe.mock.calls.map(c => c[1]);
    expect(hints).toEqual(expect.arrayContaining(['es', 'ru']));
  });

  it("reproduces the real bug: short Spanish clip — hint=ru drifts low-confidence, hint=es wins", async () => {
    // Real device-test capture, distilled. The audio is "Hola muchas
    // gracias señor. Adiós." — Spanish, ~3 seconds. The unhinted Whisper
    // we used to call returned `language: english` and routing fell back
    // to A→B (the wrong direction). The two-hinted-call architecture
    // makes the hint=es call confident and the hint=ru call hallucinated:
    whenHintedReturn({
      es: {
        text: 'Hola, muchas gracias, señor. Adiós.',
        language: 'spanish',
        avgLogprob: -0.18,
      },
      ru: {
        // Russian-hinted Whisper still emits *something* — usually a
        // phonetic Cyrillic-transcribed version, very low confidence.
        text: 'Ола муча грасиас сеньор адиос',
        language: 'russian',
        avgLogprob: -1.6,
      },
    });
    await expect(transcribeBilingual('file://clip.m4a', 'es', 'ru')).resolves.toEqual({
      text: 'Hola, muchas gracias, señor. Adiós.',
      detectedCode: 'es',
    });
  });

  it('picks Russian when the audio is Russian (the symmetric case)', async () => {
    whenHintedReturn({
      es: {
        text: 'Como estas hoy mi amigo',
        language: 'spanish',
        avgLogprob: -1.4,
      },
      ru: {
        text: 'Привет, как у тебя дела?',
        language: 'russian',
        avgLogprob: -0.22,
      },
    });
    await expect(transcribeBilingual('file://clip.m4a', 'es', 'ru')).resolves.toEqual({
      text: 'Привет, как у тебя дела?',
      detectedCode: 'ru',
    });
  });

  it('uses the surviving call when the other returns an empty (silence-gated) transcript', async () => {
    // One of the hinted Whisper calls is empty (its segments all read as
    // non-speech and the in-`transcribeAudio` gate zeroed the text);
    // the other actually heard the user.
    whenHintedReturn({
      es: { text: '', language: 'spanish', avgLogprob: -Infinity },
      ru: { text: 'Привет', language: 'russian', avgLogprob: -0.3 },
    });
    await expect(transcribeBilingual('file://clip.m4a', 'es', 'ru')).resolves.toEqual({
      text: 'Привет',
      detectedCode: 'ru',
    });
  });

  it('uses the surviving call when the other rejected with a network error', async () => {
    mockTranscribe.mockImplementation(async (_uri, hint) => {
      if (hint === 'es') throw new AppError(AppErrorType.Network, 'flaky');
      return { text: 'Привет', language: 'russian', avgLogprob: -0.3 };
    });
    await expect(transcribeBilingual('file://clip.m4a', 'es', 'ru')).resolves.toEqual({
      text: 'Привет',
      detectedCode: 'ru',
    });
  });

  it('throws NoSpeech when both calls returned empty transcripts (silence)', async () => {
    whenHintedReturn({
      es: { text: '', language: 'spanish', avgLogprob: -Infinity },
      ru: { text: '', language: 'russian', avgLogprob: -Infinity },
    });
    await expect(transcribeBilingual('file://clip.m4a', 'es', 'ru')).rejects.toMatchObject({
      type: AppErrorType.NoSpeech,
    });
  });

  it('propagates the underlying error when both calls failed', async () => {
    // Two-rejected case must surface the real error so the user can act on
    // it (retry network / fix auth) instead of seeing a generic "no speech".
    const network = new AppError(AppErrorType.Network, 'no internet');
    mockTranscribe.mockImplementation(async () => {
      throw network;
    });
    await expect(transcribeBilingual('file://clip.m4a', 'es', 'ru')).rejects.toBe(network);
  });

  it('throws NoSpeech (ambiguous) when both calls produced only low-confidence garbage', async () => {
    // Both hinted calls came back below the hallucination floor — neither
    // actually heard the user. We refuse to commit to a direction.
    whenHintedReturn({
      es: { text: 'mmm', language: 'spanish', avgLogprob: -2.2 },
      ru: { text: 'ммм', language: 'russian', avgLogprob: -2.0 },
    });
    await expect(transcribeBilingual('file://clip.m4a', 'es', 'ru')).rejects.toMatchObject({
      type: AppErrorType.NoSpeech,
    });
  });

  it('does not pass `language` as a hint to either call (defensive: only ISO codes)', async () => {
    // Catches an easy regression — accidentally forwarding the pair's full
    // names ("Spanish", "Russian") to Whisper instead of ISO codes would
    // silently downgrade hint accuracy.
    whenHintedReturn({
      es: { text: 'Hola', language: 'spanish', avgLogprob: -0.2 },
      ru: { text: 'Хола', language: 'russian', avgLogprob: -0.9 },
    });
    await transcribeBilingual('file://clip.m4a', 'es', 'ru');
    const hints = mockTranscribe.mock.calls.map(c => c[1]);
    expect(hints.every(h => h === 'es' || h === 'ru')).toBe(true);
  });
});
