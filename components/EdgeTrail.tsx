import React, { useMemo } from 'react';
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

import { colors } from '../constants/theme';

/**
 * The app's signature animation: a glowing neon line that runs along the
 * screen edge and fades behind itself — a Tron "light trail".
 *
 * It is a comet — a bright head followed by a tail of short segments with
 * decreasing opacity — that travels the screen perimeter on a loop. Colour
 * and speed are state-aware (idle / recording / processing).
 *
 * Native-primary: Skia on web needs a separately-loaded CanvasKit WASM
 * bundle, and the trail is purely decorative, so the web build skips it.
 */

export type TrailState = 'idle' | 'recording' | 'processing';

const STATE_CONFIG: Record<
  TrailState,
  { color: string; duration: number; headOpacity: number }
> = {
  idle: { color: colors.neon, duration: 7000, headOpacity: 0.85 },
  recording: { color: colors.neonMagenta, duration: 2400, headOpacity: 1 },
  processing: { color: colors.neon, duration: 3600, headOpacity: 0.95 },
};

const INSET = 3; // distance of the line from the screen edge
const CORNER_RADIUS = 22;
const STROKE_WIDTH = 2.5;
const GLOW = 6; // blur radius of the neon halo
const TAIL_SEGMENTS = 12; // comet head + tail pieces
const TRAIL_LENGTH = 0.28; // fraction of the perimeter the comet spans
const SEGMENT_LENGTH = TRAIL_LENGTH / TAIL_SEGMENTS;

/**
 * One piece of the comet tail. Rendered as two `Path` elements so the piece
 * stays correct when its window wraps past the perimeter's start/end seam:
 * the `a` path is the main span, the `b` path is the wrapped remainder
 * (degenerate — `start === end`, draws nothing — when there is no wrap).
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
    return s + 1; // wholly-negative or straddling — main span starts at s + 1
  });
  const aEnd = useDerivedValue(() => {
    const s = head.value - (index + 1) * SEGMENT_LENGTH;
    const e = head.value - index * SEGMENT_LENGTH;
    if (s >= 0 && e >= 0) return e;
    if (s < 0 && e < 0) return e + 1;
    return 1; // straddles the seam — main span runs to the end
  });
  const bEnd = useDerivedValue(() => {
    const s = head.value - (index + 1) * SEGMENT_LENGTH;
    const e = head.value - index * SEGMENT_LENGTH;
    return s < 0 && e >= 0 ? e : 0; // wrapped remainder, else degenerate
  });

  return (
    <>
      <Path
        path={path}
        style="stroke"
        strokeWidth={STROKE_WIDTH}
        strokeCap="round"
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
        strokeCap="round"
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
 * The Skia implementation. Only ever mounted on native — see the `EdgeTrail`
 * wrapper below, which bails out on web before this (and its Skia calls) run.
 */
function EdgeTrailCanvas({ state }: { state: TrailState }) {
  const { width, height } = useWindowDimensions();
  const { color, duration, headOpacity } = STATE_CONFIG[state];

  // Rounded-rectangle perimeter, inset slightly from the screen edges.
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const rect = Skia.XYWHRect(
      INSET,
      INSET,
      width - 2 * INSET,
      height - 2 * INSET,
    );
    p.addRRect(Skia.RRectXY(rect, CORNER_RADIUS, CORNER_RADIUS));
    return p;
  }, [width, height]);

  // Head position, 0→1 looping. `duration` is a dependency so a state change
  // (which changes the speed) rebuilds the worklet.
  const clock = useClock();
  const head = useDerivedValue(
    () => (clock.value % duration) / duration,
    [duration],
  );

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
  // Skia has no CanvasKit bundle on web and the trail is purely decorative,
  // so the web build skips it. This guard must run before any Skia call or
  // hook — hence the split into a wrapper and `EdgeTrailCanvas`.
  if (Platform.OS === 'web') return null;
  return <EdgeTrailCanvas state={state} />;
}
