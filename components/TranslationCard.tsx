import React, { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { testIDs } from '../constants/testIDs';
import { colors } from '../constants/theme';

interface Props {
  originalText: string;
  translatedText: string;
  sourceLabel: string;
  targetLabel: string;
}

interface SectionProps {
  text: string;
  label: string;
  accent: boolean;
  testID: string;
  textTestID: string;
}

/** One panel — fades and slides up when its text arrives. */
function Section({ text, label, accent, testID, textTestID }: SectionProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    if (text) {
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = 0;
      translateY.value = 16;
    }
  }, [text, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!text) return null;

  return (
    <Animated.View style={animStyle}>
      <View
        testID={testID}
        style={accent ? { shadowColor: colors.neon, shadowOpacity: 0.18, shadowRadius: 10 } : undefined}
        className={`mb-3 rounded-xl border p-4 ${
          accent ? 'border-neon/40 bg-surface-panel' : 'border-neon/15 bg-surface'
        }`}
      >
        <Text className="mb-2 font-mono text-[11px] uppercase tracking-[2px] text-fg-muted">
          {label}
        </Text>
        <Text
          testID={textTestID}
          // The translation is the hero — large type. The source is secondary
          // context, kept compact so the eye lands on the result.
          className={
            accent
              ? 'text-[26px] leading-9 text-neon'
              : 'text-[16px] leading-6 text-fg'
          }
        >
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function TranslationCard({
  originalText,
  translatedText,
  sourceLabel,
  targetLabel,
}: Props) {
  if (!originalText && !translatedText) return null;

  return (
    <ScrollView
      testID={testIDs.translation.card}
      className="mt-4 flex-1"
      // Centre a short result in the free space instead of pinning it to the
      // top; `flexGrow` still lets a long translation scroll normally.
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
    >
      <Section
        text={originalText}
        label={sourceLabel}
        accent={false}
        testID={`${testIDs.translation.card}-original`}
        textTestID={testIDs.translation.originalText}
      />
      <Section
        text={translatedText}
        label={targetLabel}
        accent
        testID={`${testIDs.translation.card}-translated`}
        textTestID={testIDs.translation.translatedText}
      />
    </ScrollView>
  );
}
