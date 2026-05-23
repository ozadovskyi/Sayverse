import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import {
  BlurMask,
  Canvas,
  Path,
  Skia,
  useClock,
  type SkPath,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TRAIL_BOTTOM_OFFSET,
  TRAIL_SIDE_INSET,
  TRAIL_TOP_INSET,
} from '../constants/layout';
import { colors } from '../constants/theme';
import {
  useTrailHighlightPublisher,
  type PerimeterGeometry,
} from '../contexts/TrailHighlight';

/**
 * The app's signature animation: a glowing neon line that runs along
 * the screen edge and fades behind itself — a Tron "light trail".
 *
 * It is a comet — a bright head followed by a tail of segments with
 * decreasing opacity — that travels the screen perimeter on a loop.
 * Colour and speed are state-aware (idle / recording / processing).
 *
 * EdgeTrail is purely a producer: it draws the trail and publishes the
 * comet's progress (0..1 along the perimeter) and the perimeter
 * geometry to the {@link TrailHighlightProvider}. Any element that
 * wants to brighten when the comet passes through subscribes via
 * {@link useTrailHighlightTextColor} or
 * {@link useTrailHighlightOutlineStyle}, which read those shared values
 * on the worklet and drive their own animated style. EdgeTrail itself
 * has no knowledge of which elements exist.
 *
 * Native-primary: Skia on web needs a separately-loaded CanvasKit WASM
 * bundle, and the trail is purely decorative, so the web build skips it.
 */

export type TrailState = 'idle' | 'recording' | 'processing';

const STATE_CONFIG: Record<
  TrailState,
  { color: string; duration: number; headOpacity: number }
> = {
  idle: { color: colors.neon, duration: 16000, headOpacity: 0.85 },
  recording: { color: colors.neonMagenta, duration: 5000, headOpacity: 1 },
  processing: { color: colors.neon, duration: 7500, headOpacity: 0.95 },
};

// Trail edges are placed by shared layout constants — see
// `constants/layout.ts` for the single source of truth. Importing the
// derived `TRAIL_BOTTOM_OFFSET` guarantees the trail's bottom edge
// passes through the exact vertical centre of the bottom-bar pill on
// every device, because both positions are derived from the same
// `PILL_HEIGHT` and `PILL_BOTTOM_OFFSET` constants.
// Bottom-corner radius matches the physical glass corner — ~47pt on
// cutout devices (iPhone 11+ family, Dynamic-Island models) and ~22pt
// on classic iPhones. The top edge is pushed down past the cutout via
// the safe-area inset, so we no longer need device-specific notch /
// island geometry to know "where the trail can run".
const CORNER_RADIUS_NOTCHED = 47;
const CORNER_RADIUS_CLASSIC = 22;
const NOTCHED_INSET_THRESHOLD = 40; // top safe-area inset that signals a cutout device
const STROKE_WIDTH = 2.5;
const GLOW = 6; // blur radius of the neon halo
// The tail is a stepped approximation of a true gradient — with this
// many pieces (~2.5% opacity step between adjacent segments) the steps
// fall below the perceptual threshold and the comet reads as a smooth
// fade. Butt caps (below) keep the segments abutting flush instead of
// stacking round-cap pills along the join.
const TAIL_SEGMENTS = 40;
const TRAIL_LENGTH = 0.28; // fraction of the perimeter the comet spans
const SEGMENT_LENGTH = TRAIL_LENGTH / TAIL_SEGMENTS;

/**
 * One piece of the comet tail. Rendered as two `Path` elements so the
 * piece stays correct when its window wraps past the perimeter's
 * start/end seam: the `a` path is the main span, the `b` path is the
 * wrapped remainder (degenerate — `start === end`, draws nothing —
 * when there is no wrap).
 */
function TrailSegment({
  path,
  head,
  index,
  color,
  opacity,
}: {
  path: SkPath;
  head: SharedValue<number>;
  index: number;
  color: string;
  opacity: number;
}) {
  const aStart = useDerivedValue(() => {
    const s = head.value - (index + 1) * SEGMENT_LENGTH;
    const e = head.value - index * SEGMENT_LENGTH;
    if (s >= 0 && e >= 0) return s;
    return s + 1;
  });
  const aEnd = useDerivedValue(() => {
    const s = head.value - (index + 1) * SEGMENT_LENGTH;
    const e = head.value - index * SEGMENT_LENGTH;
    if (s >= 0 && e >= 0) return e;
    if (s < 0 && e < 0) return e + 1;
    return 1;
  });
  const bEnd = useDerivedValue(() => {
    const s = head.value - (index + 1) * SEGMENT_LENGTH;
    const e = head.value - index * SEGMENT_LENGTH;
    return s < 0 && e >= 0 ? e : 0;
  });

  const cap = index === 0 ? 'round' : 'butt';
  return (
    <>
      <Path
        path={path}
        style="stroke"
        strokeWidth={STROKE_WIDTH}
        strokeCap={cap}
        strokeJoin="round"
        color={color}
        opacity={opacity}
        start={aStart}
        end={aEnd}
      >
        <BlurMask blur={GLOW} style="solid" />
      </Path>
      <Path
        path={path}
        style="stroke"
        strokeWidth={STROKE_WIDTH}
        strokeCap={cap}
        strokeJoin="round"
        color={color}
        opacity={opacity}
        start={0}
        end={bEnd}
      >
        <BlurMask blur={GLOW} style="solid" />
      </Path>
    </>
  );
}

/**
 * Build the trail's continuous path — a rounded rectangle that respects
 * the device's safe-area insets. Top edge sits below the notch / Dynamic
 * Island; bottom edge sits above the home-indicator zone. Corner radius
 * is picked by the top inset (cutout devices get the larger 47pt curve
 * to match the rounded glass).
 */
function buildCircuitPath(
  width: number,
  height: number,
  topInset: number,
  bottomInset: number,
  anchorY: number | null,
): SkPath {
  const p = Skia.Path.Make();
  const hasNotch = topInset >= NOTCHED_INSET_THRESHOLD;
  const r = hasNotch ? CORNER_RADIUS_NOTCHED : CORNER_RADIUS_CLASSIC;
  const x0 = TRAIL_SIDE_INSET;
  const x1 = width - TRAIL_SIDE_INSET;
  // Top runs flush with the safe-area boundary so the header that the
  // designer placed below the boundary has room to stay clear.
  const y0 = Math.max(TRAIL_TOP_INSET, topInset + TRAIL_TOP_INSET);
  // Bottom edge: prefer the registered anchor (measured pill centre,
  // set once on `onLayout`) for true visual centring; fall back to the
  // static layout constant for modes without a pill (conversation).
  // Either source is set per-layout, not per-frame — no jitter.
  const y1 = anchorY ?? height - bottomInset - TRAIL_BOTTOM_OFFSET;

  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.arcToTangent(x1, y0, x1, y1, r);
  p.lineTo(x1, y1 - r);
  p.arcToTangent(x1, y1, x0, y1, r);
  p.lineTo(x0 + r, y1);
  p.arcToTangent(x0, y1, x0, y0, r);
  p.lineTo(x0, y0 + r);
  p.arcToTangent(x0, y0, x1, y0, r);
  p.close();
  return p;
}

/**
 * Compute the perimeter geometry needed by highlight hooks to map an
 * element's rect to an arc-length range. The path is drawn clockwise
 * from `(x0+r, y0)`, so the bottom edge is at
 * `bottomStartT..bottomEndT` and is traversed right-to-left.
 */
function computePerimeterGeometry(
  width: number,
  height: number,
  topInset: number,
  bottomInset: number,
  anchorY: number | null,
): PerimeterGeometry {
  const hasNotch = topInset >= NOTCHED_INSET_THRESHOLD;
  const r = hasNotch ? CORNER_RADIUS_NOTCHED : CORNER_RADIUS_CLASSIC;
  const x0 = TRAIL_SIDE_INSET;
  const x1 = width - TRAIL_SIDE_INSET;
  const y0 = Math.max(TRAIL_TOP_INSET, topInset + TRAIL_TOP_INSET);
  const y1 = anchorY ?? height - bottomInset - TRAIL_BOTTOM_OFFSET;
  const cornerLength = (Math.PI / 2) * r;
  const Lh = x1 - x0 - 2 * r;
  const Lv = y1 - y0 - 2 * r;
  const totalLength = 2 * Lh + 2 * Lv + 4 * cornerLength;
  // Path order from the start point: top edge, top-right corner, right
  // edge, bottom-right corner, bottom edge, …
  const bottomStartT = (Lh + cornerLength + Lv + cornerLength) / totalLength;
  return { y1, x0r: x0 + r, x1mr: x1 - r, totalLength, bottomStartT };
}

function EdgeTrailCanvas({ state }: { state: TrailState }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { color, duration, headOpacity } = STATE_CONFIG[state];
  const publisher = useTrailHighlightPublisher();

  const anchorY = publisher?.anchorY ?? null;
  const path = useMemo(
    () =>
      buildCircuitPath(width, height, insets.top, insets.bottom, anchorY),
    [width, height, insets.top, insets.bottom, anchorY],
  );
  const geometry = useMemo(
    () =>
      computePerimeterGeometry(
        width,
        height,
        insets.top,
        insets.bottom,
        anchorY,
      ),
    [width, height, insets.top, insets.bottom, anchorY],
  );

  // Publish the perimeter geometry whenever it changes so subscriber
  // hooks can map their rects onto the path.
  useEffect(() => {
    if (!publisher) return;
    publisher.geometry.value = geometry;
  }, [publisher, geometry]);

  // Publish the trail's current colour (state-dependent) so subscriber
  // hooks interpolate toward the same hue the comet is drawing in. This
  // lets pill borders and text labels flush magenta during recording.
  useEffect(() => {
    if (!publisher) return;
    publisher.currentColor.value = color;
  }, [publisher, color]);

  // The comet's head position, looping 0→1 at `duration` ms. Published
  // to the subscriber context so highlight hooks can pull from one
  // source of truth instead of EdgeTrail pushing into each node's
  // shared value.
  const clock = useClock();
  const head = useDerivedValue(() => {
    const v = (clock.value % duration) / duration;
    if (publisher) {
      publisher.cometProgress.value = v;
    }
    return v;
  }, [duration]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: TAIL_SEGMENTS }, (_, index) => (
        <TrailSegment
          key={index}
          path={path}
          head={head}
          index={index}
          color={color}
          // Quadratic-ish falloff — bright head, gently fading tail.
          opacity={headOpacity * Math.pow(1 - index / TAIL_SEGMENTS, 1.6)}
        />
      ))}
    </Canvas>
  );
}

export default function EdgeTrail({ state }: { state: TrailState }) {
  // Skia has no CanvasKit bundle on web and the trail is purely
  // decorative, so the web build skips it. This guard must run before
  // any Skia call or hook — hence the split into a wrapper and
  // `EdgeTrailCanvas`.
  if (Platform.OS === 'web') return null;
  return <EdgeTrailCanvas state={state} />;
}
