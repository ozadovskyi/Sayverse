import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { testIDs } from '../constants/testIDs';
import { colors } from '../constants/theme';
import CopyMenu from './CopyMenu';

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
  // Measure the scroll viewport and the content so the centering rule below
  // can flip off once the content would overflow. Hooks must run before the
  // early return.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [copyVisible, setCopyVisible] = useState(false);

  const openCopy = useCallback(() => setCopyVisible(true), []);
  const closeCopy = useCallback(() => setCopyVisible(false), []);

  if (!originalText && !translatedText) return null;

  // Centre short results in the free space; once the content is taller than
  // the viewport, switch to top-pinned so `justifyContent: 'center'` doesn't
  // push the head of the text above the ScrollView's bounds (which clips it
  // — long translations were losing their first visible line).
  const fits = contentHeight > 0 && contentHeight <= viewportHeight;

  return (
    <>
      <ScrollView
        testID={testIDs.translation.card}
        className="mt-4 flex-1"
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentHeight(h)}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: fits ? 'center' : 'flex-start',
        }}
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

        {translatedText ? (
          <View className="mb-2 items-end">
            <Pressable
              testID={testIDs.copy.trigger('single')}
              accessibilityRole="button"
              accessibilityLabel="Copy translation result"
              onPress={openCopy}
              hitSlop={8}
              className="rounded-lg border border-neon/25 bg-surface px-3 py-1.5"
            >
              <Text className="font-mono text-[14px] leading-[14px] text-neon/80">⎘</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <CopyMenu
        visible={copyVisible}
        onClose={closeCopy}
        originalText={originalText}
        translatedText={translatedText}
      />
    </>
  );
}
