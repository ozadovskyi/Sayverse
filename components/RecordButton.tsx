import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeColors } from '../constants/themes';

interface Props {
  isRecording: boolean;
  isProcessing: boolean;
  onPress: () => void;
}

export default function RecordButton({ isRecording, isProcessing, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scale = useSharedValue(1);
  const glowRadius = useSharedValue(4);

  useEffect(() => {
    if (isRecording) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
      if (colors.neonGlow) {
        glowRadius.value = withRepeat(
          withSequence(
            withTiming(25, { duration: 600 }),
            withTiming(8, { duration: 600 }),
          ),
          -1,
        );
      }
    } else {
      cancelAnimation(scale);
      cancelAnimation(glowRadius);
      scale.value = withTiming(1, { duration: 200 });
      glowRadius.value = withTiming(4, { duration: 200 });
    }
  }, [isRecording, colors.neonGlow]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowRadius: glowRadius.value,
  }));

  const label = isProcessing ? 'Processing...' : isRecording ? 'Tap to stop' : 'Tap to speak';

  const buttonColor = isRecording
    ? colors.recording
    : isProcessing
      ? colors.processing
      : colors.accent;

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.glowWrapper,
        colors.neonGlow ? {
          shadowColor: isRecording ? colors.recording : colors.neonGlow,
          shadowOpacity: 0.6,
          shadowOffset: { width: 0, height: 0 },
        } : undefined,
        glowStyle,
      ]}>
        <Animated.View style={animatedStyle}>
          <Pressable
            onPress={onPress}
            disabled={isProcessing}
            style={[styles.button, { backgroundColor: buttonColor }]}
          >
            <Text style={styles.icon}>
              {isRecording ? '||' : isProcessing ? '...' : 'mic'}
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: 12,
    },
    glowWrapper: {
      borderRadius: 48,
      shadowRadius: 4,
    },
    button: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    icon: {
      fontSize: 32,
      color: colors.buttonText,
    },
    label: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
