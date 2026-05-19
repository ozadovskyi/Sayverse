import {
  isNonLexicalText,
  isNonSpeechTranscription,
  type WhisperSegment,
} from './transcription';

/**
 * A Whisper segment. `avgLogprob` defaults to a confident-speech value so a
 * test that only varies `no_speech_prob` is not accidentally flagged by the
 * log-probability gate.
 */
function seg(noSpeechProb: number, avgLogprob = -0.3): WhisperSegment {
  return { no_speech_prob: noSpeechProb, avg_logprob: avgLogprob };
}

describe('isNonLexicalText', () => {
  it('flags note glyphs Whisper emits for music', () => {
    expect(isNonLexicalText('♪ ♪')).toBe(true);
    expect(isNonLexicalText('♫♫♫')).toBe(true);
  });

  it('flags bracketed and parenthesised annotations', () => {
    expect(isNonLexicalText('[Music]')).toBe(true);
    expect(isNonLexicalText('[ Music ]')).toBe(true);
    expect(isNonLexicalText('[BLANK_AUDIO]')).toBe(true);
    expect(isNonLexicalText('(upbeat music)')).toBe(true);
  });

  it('treats empty / punctuation-only text as non-lexical', () => {
    expect(isNonLexicalText('')).toBe(true);
    expect(isNonLexicalText('...')).toBe(true);
  });

  it('does not flag real words', () => {
    expect(isNonLexicalText('Hola')).toBe(false);
    // Real speech is kept even when it carries an aside or an annotation.
    expect(isNonLexicalText('Hola (qué tal)')).toBe(false);
    expect(isNonLexicalText('[Music] Hola a todos')).toBe(false);
  });
});

describe('isNonSpeechTranscription', () => {
  it('treats an empty segment list as non-speech', () => {
    // Whisper returns no segments for empty audio.
    expect(isNonSpeechTranscription('', [])).toBe(true);
  });

  it('flags a clip where every segment is confidently silent', () => {
    expect(isNonSpeechTranscription('you', [seg(0.95)])).toBe(true);
    expect(isNonSpeechTranscription('Thank you', [seg(0.8), seg(0.91)])).toBe(true);
  });

  it('flags music — low no_speech_prob but low-confidence segments', () => {
    // Whisper does not score music as "no speech", but its token confidence
    // collapses — the avg_logprob gate is what catches it.
    expect(isNonSpeechTranscription('lyrics it invented', [seg(0.2, -1.8)])).toBe(true);
    expect(
      isNonSpeechTranscription('more invented lyrics', [seg(0.1, -1.4), seg(0.3, -2.1)]),
    ).toBe(true);
  });

  it('flags note-glyph text regardless of segment scores', () => {
    // The non-lexical check short-circuits before segments are even consulted.
    expect(isNonSpeechTranscription('♪ ♪', [seg(0.02, -0.2)])).toBe(true);
  });

  it('does not flag a clip with a real-speech segment', () => {
    expect(isNonSpeechTranscription('Hola', [seg(0.02, -0.2)])).toBe(false);
  });

  it('does not flag a clip if any segment is speech', () => {
    // One genuine segment among non-speech ones still means something was said.
    expect(
      isNonSpeechTranscription('Hola a todos', [seg(0.9), seg(0.08, -0.2), seg(0.85)]),
    ).toBe(false);
  });

  it('uses strict thresholds — exactly at the boundary is still speech', () => {
    expect(isNonSpeechTranscription('Hola', [seg(0.6, -1.0)])).toBe(false);
  });
});
