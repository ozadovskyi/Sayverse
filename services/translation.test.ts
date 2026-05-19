import { AppError } from './errors';
import { transcribeAudio } from './openai';
import { transcribeForTranslation } from './translation';

// Stub the OpenAI module so the transcription pipeline can be exercised in
// clean Node without an API key or a network call. Jest hoists `jest.mock`
// above the imports above, so `transcribeAudio` resolves to this stub.
jest.mock('./openai', () => ({ transcribeAudio: jest.fn() }));

const mockTranscribe = jest.mocked(transcribeAudio);

describe('transcribeForTranslation', () => {
  beforeEach(() => mockTranscribe.mockReset());

  it('returns trimmed text and the detected language', async () => {
    mockTranscribe.mockResolvedValue({ text: '  Hola  ', language: 'spanish' });
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
    mockTranscribe.mockResolvedValue({ text: '   ', language: '' });
    await expect(transcribeForTranslation('file://silence.m4a')).rejects.toBeInstanceOf(
      AppError,
    );
  });
});
