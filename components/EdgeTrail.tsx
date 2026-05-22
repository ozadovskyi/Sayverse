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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/** Screen-coordinate rectangle of one bottom-bar control the trail loops around. */
export interface CircuitNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STATE_CONFIG: Record<
  TrailState,
  { color: string; duration: number; headOpacity: number }
> = {
  idle: { color: colors.neon, duration: 16000, headOpacity: 0.85 },
  recording: { color: colors.neonMagenta, duration: 5000, headOpacity: 1 },
  processing: { color: colors.neon, duration: 7500, headOpacity: 0.95 },
};

const INSET = 3; // distance of the line from the screen edge
// Display corner radius for two iPhone form factors. Notched / Dynamic-Island
// devices have a ~47-55pt glass-corner radius; classic iPhones (Home button
// or modern flat-top non-island) sit closer to 0-22pt. Picked by the safe-
// area top inset so the trail's curvature matches the physical glass rather
// than reading as a square inside a rounded screen.
const CORNER_RADIUS_NOTCHED = 47;
const CORNER_RADIUS_CLASSIC = 22;
const STROKE_WIDTH = 2.5;
const GLOW = 6; // blur radius of the neon halo
const NODE_MARGIN = 4; // padding the circuit loop adds around each control
// Notch detour — the trail dips around the top cutout (notch on iPhone 11/12/
// 13/14 family; the Dynamic-Island region on iPhone 15 Pro+). 145pt is a
// conservative width covering the regular notch and the Dynamic-Island
// footprint. Real devices vary by ~10pt; the extra margin is intentional so
// the trail clears the physical glass on either side.
const NOTCH_HALF_WIDTH = 72.5;
const NOTCH_MARGIN = 4;
const NOTCHED_INSET_THRESHOLD = 40; // top safe-area inset that signals a cutout device
// The tail is a stepped approximation of a true gradient — with this many
// pieces (~2.5% opacity step between adjacent segments) the steps fall below
// the perceptual threshold and the comet reads as a smooth fade. Butt caps
// (below) keep the segments abutting flush instead of stacking round-cap
// pills along the join.
const TAIL_SEGMENTS = 40; // comet head + tail pieces
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

  // The bright head segment keeps a round cap so the leading edge reads as a
  // glowing tip; every other piece is butt-capped so adjacent segments abut
  // flush instead of stacking visible round-cap pills along the join.
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
 * Build the trail's continuous path. The perimeter follows the device's
 * rounded glass corners (radius picked by the top safe-area inset — a cutout
 * device gets the larger 47pt curve), detours below the top notch / Dynamic-
 * Island cutout instead of passing through it, and replaces the bottom edge
 * with circuit-board-style loops around the measured bottom-bar controls.
 *
 * Nodes are visited right-to-left (matching the comet's clockwise travel
 * direction along the bottom). Nodes that overlap horizontally — stacked
 * controls share an x-range — get their own loops in sequence; between two
 * loops the trail runs along the perimeter and passes behind the opaque
 * controls without conflict.
 */
function buildCircuitPath(
  width: number,
  height: number,
  nodes: CircuitNode[],
  topInset: number,
): SkPath {
  const p = Skia.Path.Make();
  const hasNotch = topInset >= NOTCHED_INSET_THRESHOLD;
  const r = hasNotch ? CORNER_RADIUS_NOTCHED : CORNER_RADIUS_CLASSIC;
  const x0 = INSET;
  const x1 = width - INSET;
  const y0 = INSET;
  const y1 = height - INSET;

  // Notch / Dynamic-Island detour geometry. The trail enters from the left
  // arc, runs along the top inset, drops down to clear the cutout, crosses
  // beneath it, comes back up, and continues to the right arc.
  const notchCx = width / 2;
  const notchLeft = notchCx - NOTCH_HALF_WIDTH;
  const notchRight = notchCx + NOTCH_HALF_WIDTH;
  const notchBottom = topInset + NOTCH_MARGIN;

  // Top-left corner + top edge (with optional notch detour) + top-right corner.
  p.moveTo(x0 + r, y0);
  if (hasNotch && notchLeft > x0 + r && notchRight < x1 - r) {
    p.lineTo(notchLeft, y0);
    p.lineTo(notchLeft, notchBottom);
    p.lineTo(notchRight, notchBottom);
    p.lineTo(notchRight, y0);
  }
  p.lineTo(x1 - r, y0);

  // Right edge + bottom-right corner.
  p.arcToTangent(x1, y0, x1, y1, r);
  p.lineTo(x1, y1 - r);
  p.arcToTangent(x1, y1, x0, y1, r);

  // Bottom edge with a one-way traversal across each node: the trail enters
  // on the right side, climbs up-and-over the three exposed sides (right,
  // top, left), and re-joins the perimeter on the opposite side. This is the
  // "wire detoured up and over the component" routing — the trail visibly
  // passes through each control instead of looping back to where it came in.
  const usable = nodes
    .filter(n => n.width > 0 && n.height > 0)
    .sort((a, b) => b.x + b.width - (a.x + a.width));
  for (const node of usable) {
    const nRight = node.x + node.width + NODE_MARGIN;
    const nLeft = node.x - NODE_MARGIN;
    const nTop = node.y - NODE_MARGIN;
    const nBottom = node.y + node.height + NODE_MARGIN;
    // A node that already reaches the perimeter line has no room to loop.
    if (nBottom >= y1) continue;

    p.lineTo(nRight, y1); // walk left along the bottom edge to the entry x
    p.lineTo(nRight, nBottom); // jog up to the node's bottom-right corner
    p.lineTo(nRight, nTop); // up the right side
    p.lineTo(nLeft, nTop); // across the top
    p.lineTo(nLeft, nBottom); // down the left side
    p.lineTo(nLeft, y1); // exit back to the perimeter on the opposite side
  }

  // Bottom-left corner and left side back up.
  p.lineTo(x0 + r, y1);
  p.arcToTangent(x0, y1, x0, y0, r);
  p.lineTo(x0, y0 + r);
  p.arcToTangent(x0, y0, x1, y0, r);
  p.close();
  return p;
}

/**
 * The Skia implementation. Only ever mounted on native — see the `EdgeTrail`
 * wrapper below, which bails out on web before this (and its Skia calls) run.
 */
function EdgeTrailCanvas({
  state,
  nodes,
}: {
  state: TrailState;
  nodes: CircuitNode[];
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { color, duration, headOpacity } = STATE_CONFIG[state];

  // The composite circuit path. Rebuilds whenever the measured nodes change
  // (mode switch, layout shift) — a brief comet-position jump is acceptable
  // because those transitions already change colour and speed.
  const path = useMemo(
    () => buildCircuitPath(width, height, nodes, insets.top),
    [width, height, nodes, insets.top],
  );

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

export default function EdgeTrail({
  state,
  nodes = [],
}: {
  state: TrailState;
  /**
   * Bottom-bar controls the trail should loop around (screen coordinates).
   * Omitted on the setup screen, where there is no bottom bar to route.
   */
  nodes?: CircuitNode[];
}) {
  // Skia has no CanvasKit bundle on web and the trail is purely decorative,
  // so the web build skips it. This guard must run before any Skia call or
  // hook — hence the split into a wrapper and `EdgeTrailCanvas`.
  if (Platform.OS === 'web') return null;
  return <EdgeTrailCanvas state={state} nodes={nodes} />;
}
