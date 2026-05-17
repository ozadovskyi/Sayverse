import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeColors } from '../constants/themes';

interface Props {
  originalText: string;
  translatedText: string;
  sourceLabel: string;
  targetLabel: string;
}

function AnimatedSection({
  text,
  label,
  style,
  textStyle,
}: {
  text: string;
  label: string;
  style: any;
  textStyle?: any;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (text) {
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = 0;
      translateY.value = 20;
    }
  }, [text]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!text) return null;

  return (
    <Animated.View style={[style, animStyle]}>
      <Text style={[{ color: '#9ca3af', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 }]}>
        {label}
      </Text>
      <Text style={[{ color: '#fff', fontSize: 18, lineHeight: 26 }, textStyle]}>
        {text}
      </Text>
    </Animated.View>
  );
}

export default function TranslationCard({ originalText, translatedText, sourceLabel, targetLabel }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!originalText && !translatedText) return null;

  return (
    <ScrollView style={styles.container}>
      <AnimatedSection
        text={originalText}
        label={sourceLabel}
        style={styles.section}
        textStyle={{ color: colors.textPrimary }}
      />
      <AnimatedSection
        text={translatedText}
        label={targetLabel}
        style={[styles.section, styles.translationSection]}
        textStyle={{ color: colors.accentText }}
      />
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      marginTop: 16,
    },
    section: {
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: colors.neonGlow ? 1 : 0,
      borderColor: colors.border,
      ...(colors.neonGlow ? {
        shadowColor: colors.neonGlow,
        shadowRadius: 8,
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 0 },
      } : {}),
    },
    translationSection: {
      backgroundColor: colors.bgTranslation,
    },
  });
