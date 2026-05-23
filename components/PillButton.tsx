import React from 'react';
import { Pressable, Text } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors } from '../constants/theme';
import { useTrailHighlightOutlineStyle } from '../contexts/TrailHighlight';

/**
 * A pill-shaped tappable label whose border + outer shadow brighten as
 * the {@link EdgeTrail} comet's body sweeps across it.
 *
 * The highlight hook lives inside this component (not in the parent),
 * so when the parent renders the pill conditionally (e.g. only in
 * `inputMode === 'voice'`), an unmount tears the hook + its
 * `useDerivedValue` worklet down — no phantom rect can stay registered
 * and light up where the button no longer is. This is the structural
 * fix that the previous Context-Map-of-nodes architecture lacked.
 *
 * Visual is driven by plain RN style props (`borderColor`,
 * `shadowColor`, `shadowOpacity`, `shadowRadius`) — no Skia overlay —
 * which keeps z-order trivially correct and removes any node-list
 * iteration from `EdgeTrail`.
 */

type Tone = 'subtle' | 'normal' | 'strong';

interface ToneStyle {
  /** Idle border colour (rgba so we can fade it toward neon). */
  base: string;
  /** Idle label colour. */
  text: string;
}

// rgba string for #00fff0 (neon) at varying opacities — matches the
// previous Tailwind `border-neon/15`, `/25`, `/40` classes.
const TONES: Record<Tone, ToneStyle> = {
  subtle: { base: 'rgba(0,255,240,0.15)', text: colors.fgMuted },
  normal: { base: 'rgba(0,255,240,0.25)', text: colors.fgMuted },
  strong: { base: 'rgba(0,255,240,0.4)', text: colors.neon },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  /** Visible label. */
  children: React.ReactNode;
  onPress: () => void;
  /** Idle border / text colour intensity. Default `normal`. */
  tone?: Tone;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel: string;
}

export default function PillButton({
  children,
  onPress,
  tone = 'normal',
  disabled,
  testID,
  accessibilityLabel,
}: Props) {
  const toneStyle = TONES[tone];
  const { ref, borderStyle } = useTrailHighlightOutlineStyle(toneStyle.base);

  return (
    <AnimatedPressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled: true } : undefined}
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          borderRadius: 9999,
          borderWidth: 1,
          paddingHorizontal: 20,
          paddingVertical: 6,
          backgroundColor: '#12121a',
        },
        borderStyle,
      ]}
    >
      <Text
        style={{
          fontFamily: 'monospace',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: toneStyle.text,
          textAlign: 'center',
        }}
      >
        {children}
      </Text>
    </AnimatedPressable>
  );
}
