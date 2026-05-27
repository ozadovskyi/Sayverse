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
    // 500 ms grace + 2000 ms initial = 2500 ms cutoff. At exactly 2500 ms
    // it must fire.
    expect(
      evaluateSilence({ now: start + 2500, startedAt: start, lastVoiceAt: null }),
    ).toBe('noSpeech');
  });

  it('does not fire noSpeech once voice has been heard', () => {
    // The user spoke at 1000 ms in. Even if we sit here past the 2500 ms
    // noSpeech cutoff, we must not classify it as noSpeech — switch to
    // trailing-silence semantics instead.
    expect(
      evaluateSilence({
        now: start + 2700,
        startedAt: start,
        lastVoiceAt: start + 1000,
      }),
    ).toBeNull();
  });

  it('fires silence after the trailing timeout following last voice', () => {
    // Last voice at 5 s; check at 5 s + 1800 ms — exact trailing cutoff.
    expect(
      evaluateSilence({
        now: start + 6800,
        startedAt: start,
        lastVoiceAt: start + 5000,
      }),
    ).toBe('silence');
  });

  it('keeps recording when trailing silence is still under the cutoff', () => {
    // 1500 ms of silence after last voice — under the 1800 ms cutoff.
    expect(
      evaluateSilence({
        now: start + 6500,
        startedAt: start,
        lastVoiceAt: start + 5000,
      }),
    ).toBeNull();
  });

  it('fires maxDuration at the hard ceiling even if speech is continuous', () => {
    // 60 s elapsed, voice still arriving — must stop anyway.
    expect(
      evaluateSilence({
        now: start + 60_000,
        startedAt: start,
        lastVoiceAt: start + 59_900,
      }),
    ).toBe('maxDuration');
  });

  it('prioritises maxDuration over a trailing-silence verdict', () => {
    // Both conditions hold at 60 s. The hard ceiling wins so the caller
    // logs it correctly (a 60-s silent recording is "max", not just
    // "silence" — different UX message).
    expect(
      evaluateSilence({
        now: start + 60_000,
        startedAt: start,
        lastVoiceAt: start + 1000,
      }),
    ).toBe('maxDuration');
  });

  it('respects a custom config for snappier turn-taking', () => {
    const conv: SilenceDetectionConfig = {
      voiceThresholdDb: -40,
      startupGraceMs: 300,
      initialTimeoutMs: 1500,
      trailingTimeoutMs: 800,
      maxDurationMs: 30_000,
    };
    // Voice at 1 s, check at 1.8 s — trailing cutoff under the custom
    // 800 ms config.
    expect(
      evaluateSilence(
        { now: start + 1800, startedAt: start, lastVoiceAt: start + 1000 },
        conv,
      ),
    ).toBe('silence');
    // Same shape, but under the default 1.8 s trailing → still running.
    expect(
      evaluateSilence({
        now: start + 1800,
        startedAt: start,
        lastVoiceAt: start + 1000,
      }),
    ).toBeNull();
  });
});
