import { isSilentTranscription, type WhisperSegment } from './transcription';

/** A Whisper segment with the given no-speech probability. */
function seg(noSpeechProb: number): WhisperSegment {
  return { no_speech_prob: noSpeechProb };
}

describe('isSilentTranscription', () => {
  it('treats an empty segment list as silence', () => {
    // Whisper returns no segments for empty audio.
    expect(isSilentTranscription([])).toBe(true);
  });

  it('flags a clip where every segment is confidently non-speech', () => {
    expect(isSilentTranscription([seg(0.95)])).toBe(true);
    expect(isSilentTranscription([seg(0.8), seg(0.91)])).toBe(true);
  });

  it('does not flag a clip with a real-speech segment', () => {
    expect(isSilentTranscription([seg(0.02)])).toBe(false);
  });

  it('does not flag a clip if any segment is speech', () => {
    // One genuine segment among non-speech ones still means something was said.
    expect(isSilentTranscription([seg(0.9), seg(0.08), seg(0.85)])).toBe(false);
  });

  it('uses a strict threshold — exactly 0.6 is not silence', () => {
    expect(isSilentTranscription([seg(0.6)])).toBe(false);
  });
});
