import {
  isNonLexicalText,
  isNonSpeechTranscription,
  isRepetitive,
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

  it('flags a repetition loop even when segments score as confident speech', () => {
    // The actual on-device bug: Whisper auto-detected English on a short
    // Spanish clip, hallucinated "Hello, how are you?" and emitted it twice.
    // no_speech_prob and avg_logprob both look healthy — the only signal is
    // the duplicated phrase itself.
    expect(
      isNonSpeechTranscription(
        'Hello, how are you? Hello, how are you?',
        [seg(0.02, -0.2)],
      ),
    ).toBe(true);
  });
});

describe('isRepetitive', () => {
  it('flags the doubled-phrase bug observed on iOS device', () => {
    expect(isRepetitive('Hello, how are you? Hello, how are you?')).toBe(true);
  });

  it('flags a Whisper-classic silence hallucination repeated', () => {
    expect(
      isRepetitive('Thank you for watching. Thank you for watching.'),
    ).toBe(true);
  });

  it('flags triple-or-more repetition of a multi-word phrase', () => {
    expect(
      isRepetitive(
        'Subtitles by the Amara.org community. Subtitles by the Amara.org community. Subtitles by the Amara.org community.',
      ),
    ).toBe(true);
  });

  it('flags a Spanish single-word loop with enough words to clear the floor', () => {
    expect(isRepetitive('hola, hola, hola, hola, hola, hola, hola.')).toBe(true);
  });

  it('does not flag natural multi-sentence speech', () => {
    expect(
      isRepetitive('Hello, how are you? I am doing fine, thank you very much.'),
    ).toBe(false);
  });

  it('does not flag hesitation where punctuation distinguishes the tokens', () => {
    // "I think," ≠ "I think" — the comma keeps these as distinct word
    // sequences so natural restarts are not flagged.
    expect(
      isRepetitive('I think, I think we should consider both options carefully.'),
    ).toBe(false);
  });

  it('does not flag short outputs where repetition is unreliable signal', () => {
    // Fewer than six words is not enough to be confidently a Whisper loop —
    // genuine short utterances ("Si si si", "ya ya ya") read as repetition
    // but are not hallucination.
    expect(isRepetitive('Hello. Hello. Hello.')).toBe(false);
    expect(isRepetitive('')).toBe(false);
  });

  it('does not flag natural lists where a single word recurs as a connector', () => {
    // A list of items where the same connector repeats — natural speech, not
    // a Whisper loop. The 2-word/8-char floor and the requirement that the
    // *same multi-word sequence* repeat keeps this out of the gate.
    expect(
      isRepetitive('the cat, the dog, the mouse, the rabbit, the bird, the fish'),
    ).toBe(false);
  });
});
