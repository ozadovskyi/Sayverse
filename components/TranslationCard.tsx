import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { testIDs } from '../constants/testIDs';
import { colors } from '../constants/theme';
import { tts } from '../services/tts';
import CopyMenu from './CopyMenu';

interface Props {
  originalText: string;
  translatedText: string;
  sourceLabel: string;
  targetLabel: string;
  /**
   * BCP-47 code of the target language. Passed to `expo-speech` via the TTS
   * provider so the tap-to-replay button reads the translation in the right
   * voice instead of the device locale's default.
   */
  targetLangCode: string;
  /**
   * When `originalText` is set but `translatedText` is still empty, render a
   * "Translating…" placeholder card so the user has a visible signal that the
   * translate call is in flight. Without it the source card just sits there
   * for the duration of the network call with no indication anything is
   * happening.
   */
  isTranslating?: boolean;
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

/**
 * Placeholder card that fills the translated-section slot while the API
 * call is in flight. Matches the neon accent styling of the real result
 * card so the result swap is a content fade-in, not a layout jump.
 */
function TranslatingPlaceholder({ label }: { label: string }) {
  return (
    <View
      className="mb-3 rounded-xl border border-neon/40 bg-surface-panel p-4"
      style={{ shadowColor: colors.neon, shadowOpacity: 0.18, shadowRadius: 10 }}
    >
      <Text className="mb-2 font-mono text-[11px] uppercase tracking-[2px] text-fg-muted">
        {label}
      </Text>
      <View className="flex-row items-center gap-3 py-1">
        <ActivityIndicator size="small" color={colors.neon} />
        <Text className="font-mono text-xs uppercase tracking-[2px] text-neon">
          Translating…
        </Text>
      </View>
    </View>
  );
}

export default function TranslationCard({
  originalText,
  translatedText,
  sourceLabel,
  targetLabel,
  targetLangCode,
  isTranslating = false,
}: Props) {
  // Measure the scroll viewport and the content so the centering rule below
  // can flip off once the content would overflow. Hooks must run before the
  // early return.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [copyVisible, setCopyVisible] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Scroll-to-start-of-translation behaviour (A2 of the v1.1 UX plan):
  // when a fresh translation result lands, jump the ScrollView so the user
  // immediately sees the **top** of the translated section instead of the
  // top of the source. Critical for long results that overflow the viewport.
  const scrollRef = useRef<ScrollView>(null);
  const translatedYRef = useRef<number | null>(null);
  const prevTranslatedRef = useRef('');

  const openCopy = useCallback(() => setCopyVisible(true), []);
  const closeCopy = useCallback(() => setCopyVisible(false), []);

  // Manual replay TTS. The speak-aloud Setting drives the *automatic* read
  // path; this button is the on-demand variant for the single-shot card —
  // standard across translator apps (Apple/Google/DeepL all have it).
  // expo-speech does not expose an "isSpeaking" event, so we treat the
  // returned promise as the lifecycle: `speak` resolves on done / stopped /
  // error, at which point we flip the visual state back to idle.
  const handleSpeak = useCallback(async () => {
    if (isSpeaking) {
      tts.stop();
      return;
    }
    if (!translatedText || !targetLangCode) return;
    setIsSpeaking(true);
    await tts.speak(translatedText, targetLangCode);
    setIsSpeaking(false);
  }, [isSpeaking, translatedText, targetLangCode]);

  // Stop in-flight playback if the result is replaced (new translation
  // started, history entry selected, or the user logged out and the card
  // unmounted). Otherwise a stale speak call would keep reading the old
  // text under the new card.
  useEffect(() => {
    return () => {
      tts.stop();
    };
  }, [translatedText]);

  const handleTranslatedLayout = useCallback((e: LayoutChangeEvent) => {
    translatedYRef.current = e.nativeEvent.layout.y;
  }, []);

  useEffect(() => {
    // Only on the empty → non-empty transition; re-renders that keep the
    // same text (e.g. parent layout changes) must not yank the scroll.
    const justArrived = !prevTranslatedRef.current && translatedText;
    if (justArrived && translatedYRef.current !== null) {
      scrollRef.current?.scrollTo({
        y: translatedYRef.current,
        animated: true,
      });
    }
    prevTranslatedRef.current = translatedText;
  }, [translatedText]);

  // Render condition: keep the card mounted while a translation is in flight
  // so the placeholder + auto-scroll layout machinery have stable refs to work
  // with. Without `isTranslating` we collapse back to the original early
  // return so the empty state is unchanged.
  if (!originalText && !translatedText && !isTranslating) return null;

  // Centre short results in the free space; once the content is taller than
  // the viewport, switch to top-pinned so `justifyContent: 'center'` doesn't
  // push the head of the text above the ScrollView's bounds (which clips it
  // — long translations were losing their first visible line).
  const fits = contentHeight > 0 && contentHeight <= viewportHeight;

  // Show the translating placeholder once the source has been captured but
  // before the model has returned. Mid-pipeline (audio recorded, transcript
  // not yet back) `originalText` is still empty — that case is handled by
  // the parent's empty-area loading state.
  const showTranslatingPlaceholder =
    isTranslating && !!originalText && !translatedText;

  return (
    <>
      <ScrollView
        ref={scrollRef}
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
        <View onLayout={handleTranslatedLayout}>
          {showTranslatingPlaceholder ? (
            <TranslatingPlaceholder label={targetLabel} />
          ) : (
            <Section
              text={translatedText}
              label={targetLabel}
              accent
              testID={`${testIDs.translation.card}-translated`}
              textTestID={testIDs.translation.translatedText}
            />
          )}
        </View>

        {translatedText ? (
          <View className="mb-2 flex-row items-center justify-end gap-2">
            <Pressable
              testID={testIDs.translation.speakButton}
              accessibilityRole="button"
              accessibilityLabel={
                isSpeaking ? 'Stop reading translation' : 'Read translation aloud'
              }
              accessibilityState={{ selected: isSpeaking }}
              onPress={handleSpeak}
              hitSlop={8}
              className="rounded-lg border border-neon/25 bg-surface px-3 py-1.5"
            >
              <Text className="font-mono text-[14px] leading-[14px] text-neon/80">
                {isSpeaking ? '■' : '▶'}
              </Text>
            </Pressable>
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
