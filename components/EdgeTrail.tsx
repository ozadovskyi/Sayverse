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

/**
 * Screen-coordinate rectangle of one bottom-bar control. The trail lights
 * the control's outline up as the comet passes through it — only when the
 * perimeter actually intersects the rect. Controls that sit safely inside
 * the safe area are passed through too and just stay dark.
 */
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
// Bottom-corner radius matches the physical glass corner — ~47pt on cutout
// devices (iPhone 11+ family, Dynamic-Island models) and ~22pt on classic
// iPhones. The top edge is pushed down past the cutout via the safe-area
// inset (see `buildCircuitPath`), so we no longer need device-specific notch
// or island geometry to know "where the trail can run".
const CORNER_RADIUS_NOTCHED = 47;
const CORNER_RADIUS_CLASSIC = 22;
const NOTCHED_INSET_THRESHOLD = 40; // top safe-area inset that signals a cutout device
const STROKE_WIDTH = 2.5;
const GLOW = 6; // blur radius of the neon halo
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
 * Build the trail's continuous path.
 *
 * The trail is a rounded rectangle that respects the device's safe-area
 * insets:
 *
 * - Top edge runs at `insets.top + INSET`, so it sits below the notch /
 *   Dynamic-Island cutout on cutout devices and below the status bar on
 *   classic iPhones. No device-specific cutout geometry is needed.
 * - Bottom edge runs at `height - insets.bottom - INSET`, so it stays
 *   above the home-indicator zone on no-home-button models.
 * - Corner radius is picked by the top inset — cutout devices get the
 *   larger 47pt curve to match the rounded glass.
 *
 * The trail does not detour around the bottom-bar controls. Those
 * controls live inside the safe area with their own padding, so they
 * never reach the trail's perimeter — the trail simply runs along the
 * edge and the buttons stay clear of it without explicit routing. (If a
 * future layout puts a control flush with an edge, that case would need
 * a different visual — "the trail lights up the control's outline" — but
 * it does not exist today.)
 */
function buildCircuitPath(
  width: number,
  height: number,
  topInset: number,
  bottomInset: number,
): SkPath {
  const p = Skia.Path.Make();
  const hasNotch = topInset >= NOTCHED_INSET_THRESHOLD;
  const r = hasNotch ? CORNER_RADIUS_NOTCHED : CORNER_RADIUS_CLASSIC;
  const x0 = INSET;
  const x1 = width - INSET;
  const y0 = Math.max(INSET, topInset + INSET);
  const y1 = height - Math.max(INSET, bottomInset + INSET);

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
 * Geometry of the perimeter that intersection math needs. Lengths and the
 * t-value (0..1 along the closed path) at which the bottom edge starts.
 * The path is drawn clockwise from (x0+r, y0), so the bottom edge is at
 * `bottomStartT..bottomEndT` and is traversed right-to-left.
 */
interface PerimeterGeometry {
  y1: number;
  x0r: number; // x0 + r — left bound of bottom edge straight segment
  x1mr: number; // x1 - r — right bound of bottom edge straight segment
  totalLength: number;
  bottomStartT: number;
}

function computePerimeterGeometry(
  width: number,
  height: number,
  topInset: number,
  bottomInset: number,
): PerimeterGeometry {
  const hasNotch = topInset >= NOTCHED_INSET_THRESHOLD;
  const r = hasNotch ? CORNER_RADIUS_NOTCHED : CORNER_RADIUS_CLASSIC;
  const x0 = INSET;
  const x1 = width - INSET;
  const y0 = Math.max(INSET, topInset + INSET);
  const y1 = height - Math.max(INSET, bottomInset + INSET);
  const cornerLength = (Math.PI / 2) * r;
  const Lh = x1 - x0 - 2 * r;
  const Lv = y1 - y0 - 2 * r;
  const totalLength = 2 * Lh + 2 * Lv + 4 * cornerLength;
  // Path order: top edge, top-right corner, right edge, bottom-right corner,
  // bottom edge, …
  const bottomStartT = (Lh + cornerLength + Lv + cornerLength) / totalLength;
  return { y1, x0r: x0 + r, x1mr: x1 - r, totalLength, bottomStartT };
}

/**
 * One control's outline overlay. When the perimeter passes through the
 * control's bounds (the bottom edge cuts through it), the outline glows
 * as the comet head sweeps the corresponding arc-length range — the
 * "trail lights up what it touches" rule. Controls fully inside the safe
 * area never intersect and stay dark.
 */
function NodeOutline({
  node,
  head,
  geometry,
  color,
}: {
  node: CircuitNode;
  head: SharedValue<number>;
  geometry: PerimeterGeometry;
  color: string;
}) {
  // Pre-compute the intersection arc-length range, captured by the worklet.
  // Bottom-edge intersection only — the only side that crosses controls in
  // this layout. Top/right/left edges run inside the safe area, beyond
  // every measured rect.
  const crosses =
    node.y < geometry.y1 && node.y + node.height > geometry.y1;
  const xRight = Math.min(node.x + node.width, geometry.x1mr);
  const xLeft = Math.max(node.x, geometry.x0r);
  const active = crosses && xRight > xLeft;
  const tEntry = active
    ? geometry.bottomStartT + (geometry.x1mr - xRight) / geometry.totalLength
    : -1;
  const tExit = active
    ? geometry.bottomStartT + (geometry.x1mr - xLeft) / geometry.totalLength
    : -1;
  // Fade margin in t-units — the tail leads and lingers, so the outline
  // brightens before the head enters and dims after it leaves.
  const fade = TRAIL_LENGTH / 2;

  const opacity = useDerivedValue(() => {
    if (!active) return 0;
    const h = head.value;
    if (h < tEntry - fade || h > tExit + fade) return 0;
    if (h < tEntry) return (h - (tEntry - fade)) / fade;
    if (h > tExit) return 1 - (h - tExit) / fade;
    return 1;
  });

  const outlinePath = useMemo(() => {
    const p = Skia.Path.Make();
    const radius = Math.min(node.width, node.height) / 2;
    p.addRRect(
      Skia.RRectXY(
        Skia.XYWHRect(node.x, node.y, node.width, node.height),
        radius,
        radius,
      ),
    );
    return p;
  }, [node.x, node.y, node.width, node.height]);

  return (
    <Path
      path={outlinePath}
      style="stroke"
      strokeWidth={STROKE_WIDTH}
      strokeJoin="round"
      color={color}
      opacity={opacity}
    >
      <BlurMask blur={GLOW * 1.6} style="solid" />
    </Path>
  );
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

  // Rebuilds when the viewport changes (rotation, foldable, etc) or when
  // the safe-area insets shift (e.g. status-bar height change). The trail
  // is purely a rounded-rect perimeter — node outlines are drawn separately.
  const path = useMemo(
    () => buildCircuitPath(width, height, insets.top, insets.bottom),
    [width, height, insets.top, insets.bottom],
  );
  const geometry = useMemo(
    () => computePerimeterGeometry(width, height, insets.top, insets.bottom),
    [width, height, insets.top, insets.bottom],
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
      {nodes.map((node, i) => (
        <NodeOutline
          key={`${i}-${node.x}-${node.y}-${node.width}-${node.height}`}
          node={node}
          head={head}
          geometry={geometry}
          color={color}
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
   * Bottom-bar controls the trail should highlight when its bottom-edge
   * cuts through them. Controls inside the safe area never intersect and
   * stay dark; passing them in is harmless.
   */
  nodes?: CircuitNode[];
}) {
  // Skia has no CanvasKit bundle on web and the trail is purely decorative,
  // so the web build skips it. This guard must run before any Skia call or
  // hook — hence the split into a wrapper and `EdgeTrailCanvas`.
  if (Platform.OS === 'web') return null;
  return <EdgeTrailCanvas state={state} nodes={nodes} />;
}
