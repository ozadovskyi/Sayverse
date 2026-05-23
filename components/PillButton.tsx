import React from 'react';
import { Pressable, Text } from 'react-native';
import Animated from 'react-native-reanimated';

import { PILL_HEIGHT } from '../constants/layout';
import { colors } from '../constants/theme';
import {
  useTrailHighlightAnchor,
  useTrailHighlightOutlineStyle,
} from '../contexts/TrailHighlight';

/**
 * A pill-shaped tappable label whose border + outer shadow brighten as
 * the {@link EdgeTrail} comet's body sweeps across it.
 *
 * Structure:
 *   Animated.View  ←  ref + animated border/shadow style (this is what
 *                     `measureInWindow` reads, and what the user sees
 *                     as the visible pill outline)
 *     Pressable    ←  hit target only (no border/shadow)
 *       Text
 *
 * The two-element split is required because Reanimated's
 * `createAnimatedComponent(Pressable)` does not pass `measureInWindow`
 * (or `onLayout`) through to the underlying native node reliably,
 * which broke the trail-through-pill-centre anchor on every device.
 * `Animated.View` is a first-class Reanimated component and exposes
 * the native measurement API directly.
 *
 * The hook lives inside this component (not in the parent), so when
 * the parent renders the pill conditionally (e.g. only in
 * `inputMode === 'voice'`), unmounting tears the hook + its anchor
 * registration down — no phantom rect can stay registered.
 */

type Tone = 'subtle' | 'normal' | 'strong';

interface ToneStyle {
  /** Idle border colour (rgba so we can fade it toward neon). */
  base: string;
  /** Idle label colour. */
  text: string;
}

const TONES: Record<Tone, ToneStyle> = {
  subtle: { base: 'rgba(0,255,240,0.15)', text: colors.fgMuted },
  normal: { base: 'rgba(0,255,240,0.25)', text: colors.fgMuted },
  strong: { base: 'rgba(0,255,240,0.4)', text: colors.neon },
};

interface Props {
  /** Visible label. */
  children: React.ReactNode;
  onPress: () => void;
  /** Idle border / text colour intensity. Default `normal`. */
  tone?: Tone;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel: string;
  /**
   * Pin the trail's bottom edge to run through this pill's actual
   * vertical centre, measured at layout time. Use on the single
   * dominant bottom-bar control (TYPE in single-shot voice mode) so
   * the comet visibly threads the button on every device.
   */
  anchor?: boolean;
}

export default function PillButton({
  children,
  onPress,
  tone = 'normal',
  disabled,
  testID,
  accessibilityLabel,
  anchor = false,
}: Props) {
  const toneStyle = TONES[tone];
  const { ref, borderStyle } = useTrailHighlightOutlineStyle(toneStyle.base);
  // No-op when ref is null (anchor === false on this instance).
  useTrailHighlightAnchor(anchor ? ref : null);

  return (
    <Animated.View
      ref={ref}
      style={[
        {
          // Explicit fixed height so the anchor measurement is stable
          // across font baseline / dynamic-type changes.
          height: PILL_HEIGHT,
          borderRadius: 9999,
          borderWidth: 1,
          backgroundColor: '#12121a',
          // Centre the Pressable contents horizontally + vertically.
          alignSelf: 'flex-start',
        },
        borderStyle,
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={disabled ? { disabled: true } : undefined}
        onPress={onPress}
        disabled={disabled}
        style={{
          flex: 1,
          paddingHorizontal: 20,
          justifyContent: 'center',
        }}
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
      </Pressable>
    </Animated.View>
  );
}
