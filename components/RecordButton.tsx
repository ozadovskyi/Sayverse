import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { testIDs } from '../constants/testIDs';
import { colors } from '../constants/theme';
import {
  useTrailHighlightAnchor,
  useTrailHighlightTextColor,
} from '../contexts/TrailHighlight';

interface Props {
  isRecording: boolean;
  isProcessing: boolean;
  /** Conversation mode is playing a translation aloud — tapping stops it. */
  isSpeaking?: boolean;
  onPress: () => void;
  /**
   * Pin the trail's bottom edge through the centre of the label
   * ("TAP TO SPEAK"). Used in conversation mode where there is no
   * trailing pill control — the label itself becomes the anchor so
   * the comet visibly threads it.
   */
  anchorBottom?: boolean;
  /**
   * Drop the visible "Tap to speak" caption. Used in conversation mode
   * where the status line above the button already says the same thing
   * ("Tap to speak the next turn") and the duplicate read as clutter.
   * The Text element stays in the layout so the trail anchor still has
   * something to measure — just invisible to the user.
   */
  hideLabel?: boolean;
  /**
   * Current normalised input level (0..1). Drives the live level bar
   * under the button so the user can see the mic actually hearing them
   * — closes the NN/g "Gulf of Execution" on voice recording. 0 when
   * not recording.
   */
  level?: number;
  /**
   * Whether VAD has heard at least one frame above the voice threshold
   * since recording started. Flips the caption from "Listening…" to
   * "Heard you" — the user-visible signal that the recorder is in fact
   * picking up speech.
   */
  hasHeardSpeech?: boolean;
}

export default function RecordButton({
  isRecording,
  isProcessing,
  isSpeaking = false,
  onPress,
  anchorBottom = false,
  hideLabel = false,
  level = 0,
  hasHeardSpeech = false,
}: Props) {
  // The bottom "TAP TO SPEAK" label sits at the very bottom of the
  // layout, close to the trail's perimeter. Drive its glyph colour off
  // the trail's pull-model: the hook attaches an animated ref, then a
  // worklet-side derived value measures the label every cometProgress
  // tick and interpolates the colour from muted to neon as the comet
  // sweeps across. `from` matches the static `text-fg-muted` class;
  // `to` is the trail's neon.
  const labelHighlight = useTrailHighlightTextColor(colors.fgMuted);
  // No-op when anchorBottom=false; in conversation mode the label
  // becomes the trail's bottom anchor.
  useTrailHighlightAnchor(anchorBottom ? labelHighlight.ref : null);
  const scale = useSharedValue(1);
  const glow = useSharedValue(6);

  // Recording and speak-aloud are both live states the user can tap to stop —
  // they pulse and show the square "stop" glyph.
  const active = isRecording || isSpeaking;

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(26, { duration: 600 }),
          withTiming(10, { duration: 600 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(glow);
      scale.value = withTiming(1, { duration: 200 });
      glow.value = withTiming(6, { duration: 200 });
    }
  }, [active, scale, glow]);

  const accent = isRecording
    ? colors.neonMagenta
    : isSpeaking
      ? colors.neon
      : isProcessing
        ? colors.fgFaint
        : colors.neon;

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowColor: accent,
    shadowOpacity: 0.7,
    shadowRadius: glow.value,
    shadowOffset: { width: 0, height: 0 },
  }));

  const label = isProcessing
    ? 'Processing'
    : isRecording
      ? hasHeardSpeech
        ? 'Heard you'
        : 'Listening…'
      : isSpeaking
        ? 'Tap to stop'
        : 'Tap to speak';

  // Live level bar — 4 segments lit progressively. Clamp the input so a
  // single stray sample can't push the bar to full / negative. Only
  // visible while recording; otherwise rendered at zero so the layout
  // does not shift when the button activates.
  const levelClamped = Math.max(0, Math.min(1, level));
  const litSegments = isRecording ? Math.round(levelClamped * 4) : 0;

  return (
    <View className="items-center gap-3">
      <Animated.View style={[{ borderRadius: 48 }, wrapStyle]}>
        <Pressable
          testID={testIDs.record.button}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: isProcessing, busy: isProcessing }}
          onPress={onPress}
          disabled={isProcessing}
          className="h-24 w-24 items-center justify-center rounded-full border-2 bg-surface"
          style={{ borderColor: accent }}
        >
          {/* A filled square reads as "stop" while active, a dot otherwise. */}
          <View
            className={active ? 'h-7 w-7 rounded-md' : 'h-7 w-7 rounded-full'}
            style={{ backgroundColor: accent }}
          />
        </Pressable>
      </Animated.View>
      {/* Four-segment level bar — visible only during recording.
          Reserved layout slot at all times so the button does not jump
          when state changes. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="h-1.5 flex-row gap-1"
        style={{ opacity: isRecording ? 1 : 0 }}
      >
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            className="h-1.5 w-3 rounded-full"
            style={{
              backgroundColor: i < litSegments ? colors.neon : 'rgba(0,255,240,0.12)',
            }}
          />
        ))}
      </View>
      <Animated.Text
        ref={labelHighlight.ref}
        style={[labelHighlight.colorStyle, hideLabel ? { opacity: 0 } : undefined]}
        // Keep the Text mounted even when `hideLabel` is set so the trail
        // anchor (`measureInWindow` on this ref) still has a real element
        // to measure — opacity 0 hides the glyphs without collapsing the
        // layout box.
        className="font-mono text-xs uppercase tracking-[2px]"
        accessibilityElementsHidden={hideLabel}
        importantForAccessibility={hideLabel ? 'no-hide-descendants' : 'auto'}
      >
        {label}
      </Animated.Text>
    </View>
  );
}
