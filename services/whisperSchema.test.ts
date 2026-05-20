import { WhisperVerboseJsonSchema } from './whisperSchema';

/**
 * The contract test for the Whisper response shape we depend on. If the
 * OpenAI API drops or renames one of these fields, *this* test is the early
 * warning — and the schema above is the place to record the change.
 */
describe('Whisper verbose_json contract', () => {
  /** A typical successful response, copied from a real `verbose_json` reply. */
  const realisticResponse = {
    task: 'transcribe',
    language: 'spanish',
    duration: 2.3,
    text: 'Hola, ¿cómo estás?',
    segments: [
      {
        id: 0,
        seek: 0,
        start: 0,
        end: 2.3,
        text: 'Hola, ¿cómo estás?',
        tokens: [50364, 4783, 11, 8129, 50479],
        temperature: 0,
        avg_logprob: -0.31,
        compression_ratio: 1.02,
        no_speech_prob: 0.05,
      },
    ],
  };

  it('accepts a realistic verbose_json response', () => {
    expect(() => WhisperVerboseJsonSchema.parse(realisticResponse)).not.toThrow();
  });

  it('accepts a response with no segments (silent audio path)', () => {
    expect(() =>
      WhisperVerboseJsonSchema.parse({ text: '', language: 'spanish' }),
    ).not.toThrow();
  });

  it('rejects a response missing `text` — every caller dereferences it', () => {
    expect(() =>
      WhisperVerboseJsonSchema.parse({ language: 'spanish', segments: [] }),
    ).toThrow();
  });

  it('rejects a response missing `language` — auto-detect routing needs it', () => {
    expect(() =>
      WhisperVerboseJsonSchema.parse({ text: 'Hola', segments: [] }),
    ).toThrow();
  });

  it('rejects a segment missing `no_speech_prob` — the silence gate needs it', () => {
    expect(() =>
      WhisperVerboseJsonSchema.parse({
        text: 'Hola',
        language: 'spanish',
        segments: [{ avg_logprob: -0.3 }],
      }),
    ).toThrow();
  });

  it('rejects a segment missing `avg_logprob` — the music-hallucination gate needs it', () => {
    expect(() =>
      WhisperVerboseJsonSchema.parse({
        text: 'Hola',
        language: 'spanish',
        segments: [{ no_speech_prob: 0.05 }],
      }),
    ).toThrow();
  });
});
