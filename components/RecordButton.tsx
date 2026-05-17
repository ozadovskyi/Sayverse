import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
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

interface Props {
  isRecording: boolean;
  isProcessing: boolean;
  /** Conversation mode is playing a translation aloud — tapping stops it. */
  isSpeaking?: boolean;
  onPress: () => void;
}

export default function RecordButton({
  isRecording,
  isProcessing,
  isSpeaking = false,
  onPress,
}: Props) {
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
    : active
      ? 'Tap to stop'
      : 'Tap to speak';

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
      <Text className="font-mono text-xs uppercase tracking-[2px] text-fg-muted">
        {label}
      </Text>
    </View>
  );
}
