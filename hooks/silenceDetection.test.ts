import {
  evaluateSilence,
  isVoiceLevel,
  type SilenceDetectionConfig,
} from './silenceDetection';

describe('isVoiceLevel', () => {
  it('treats a -30 dBFS reading (typical indoor speech) as voice', () => {
    expect(isVoiceLevel(-30)).toBe(true);
  });

  it('treats -40 dBFS exactly as voice (threshold is inclusive)', () => {
    expect(isVoiceLevel(-40)).toBe(true);
  });

  it('treats a -55 dBFS reading (quiet room) as silence', () => {
    expect(isVoiceLevel(-55)).toBe(false);
  });
});

describe('evaluateSilence', () => {
  const start = 1_000_000;

  it('keeps recording during the startup grace, even with no voice yet', () => {
    // 400 ms in, well inside the 500 ms grace window — too early to
    // declare "no speech".
    expect(
      evaluateSilence({ now: start + 400, startedAt: start, lastVoiceAt: null }),
    ).toBeNull();
  });

  it('fires noSpeech once grace + initial timeout have elapsed without voice', () => {
    // 500 ms grace + 30 s initial = 30 500 ms cutoff. At exactly the
    // cutoff the safety fallback must fire.
    expect(
      evaluateSilence({ now: start + 30_500, startedAt: start, lastVoiceAt: null }),
    ).toBe('noSpeech');
  });

  it('does not fire noSpeech once voice has been heard', () => {
    // The user spoke at 1 s in. We sit here past the 30 500 ms cutoff —
    // we must not classify it as noSpeech because voice was actually
    // heard. Trailing-silence is disabled by default so the recording
    // also does not auto-stop on the silence path.
    expect(
      evaluateSilence({
        now: start + 35_000,
        startedAt: start,
        lastVoiceAt: start + 1000,
      }),
    ).toBeNull();
  });

  it('does not auto-stop on trailing silence by default (user taps stop)', () => {
    // Voice at 5 s, 60 s of trailing silence later — defaults keep
    // the recording running. The user owns the end-of-utterance signal.
    expect(
      evaluateSilence({
        now: start + 65_000,
        startedAt: start,
        lastVoiceAt: start + 5000,
      }),
    ).toBeNull();
  });

  it('fires maxDuration at the 5-minute hard ceiling even with continuous voice', () => {
    // 300 s elapsed, voice still arriving — hard cap stops the recording
    // anyway. Protects against "left the mic on in a pocket" battery /
    // memory drain; Whisper's own 25-min limit is well above this.
    expect(
      evaluateSilence({
        now: start + 300_000,
        startedAt: start,
        lastVoiceAt: start + 299_900,
      }),
    ).toBe('maxDuration');
  });

  it('prioritises maxDuration over a still-running recording', () => {
    // Voice at 1 s, now 300 s. Hard cap wins regardless of how silent or
    // not the recent past was.
    expect(
      evaluateSilence({
        now: start + 300_000,
        startedAt: start,
        lastVoiceAt: start + 1000,
      }),
    ).toBe('maxDuration');
  });

  it('respects a custom config that opts back into trailing silence', () => {
    // Opt-in: a future conversation mode or settings toggle may want a
    // shorter, conversational endpointing. The pure logic accepts any
    // positive trailingTimeoutMs.
    const opt: SilenceDetectionConfig = {
      voiceThresholdDb: -40,
      startupGraceMs: 300,
      initialTimeoutMs: 1500,
      trailingTimeoutMs: 800,
      maxDurationMs: 30_000,
    };
    expect(
      evaluateSilence(
        { now: start + 1800, startedAt: start, lastVoiceAt: start + 1000 },
        opt,
      ),
    ).toBe('silence');
    // Same shape under the defaults — trailing disabled, recording keeps going.
    expect(
      evaluateSilence({
        now: start + 1800,
        startedAt: start,
        lastVoiceAt: start + 1000,
      }),
    ).toBeNull();
  });
});
