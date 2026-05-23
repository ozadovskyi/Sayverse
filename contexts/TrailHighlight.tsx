import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { View } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Spatial-glow context for the {@link EdgeTrail} animation.
 *
 * Pull architecture (rev 2026-05-22, replaces a push-based registry that
 * suffered from three RN/Skia plumbing pain points):
 *
 * 1. **Provider** publishes two shared values for every consumer:
 *    - `cometProgress` — head position (0..1) along the perimeter path,
 *      written from {@link EdgeTrail}'s clock worklet.
 *    - `geometry` — perimeter pixel geometry (bottom edge y, edge
 *      x-bounds, total length, t-value at which the bottom edge starts),
 *      written from {@link EdgeTrail} on layout.
 *
 * 2. **`useTrailHighlight…` hooks** return a `ref` to attach to the
 *    element plus animated styles to apply. Internally each hook:
 *      - holds a plain `useRef<View>` (stable RN API),
 *      - on mount, periodically `measureInWindow`s the element from the
 *        JS thread and writes the rect into a shared value (this is the
 *        stable replacement for `onLayout`, which RN does not fire
 *        reliably when a parent's layout changes without unmount; a
 *        250ms cadence handles every realistic layout change),
 *      - runs a `useDerivedValue` on the UI thread on every
 *        `cometProgress` tick that maps the cached rect to its
 *        arc-length range and writes a 0..1 `glowIntensity`.
 *    The component reads `glowIntensity` in its own `useAnimatedStyle`
 *    to drive whatever visual it wants.
 *
 *    Why this beats the previous push-based registry:
 *    - The hook lives *inside* the consumer component (in `PillButton`,
 *      `RecordButton`, or right next to the conditional `Animated.View`
 *      in `App.tsx`). When the consumer unmounts, the interval is
 *      cleared, the derived value tears down, and no phantom rect
 *      remains. Conditional rendering (`{cond && <PillButton />}`)
 *      becomes free of phantom-cleanup bugs.
 *    - `measureInWindow` on a coarse timer is more robust than
 *      `onLayout`. It catches parent layout changes without unmount.
 *    - One shared `cometProgress` instead of pushing into per-node
 *      shared values from EdgeTrail — fewer bridge crossings, no
 *      per-node animated reactions to maintain.
 *
 * 3. Two convenience hooks:
 *    - {@link useTrailHighlightTextColor} — text labels glow by
 *      interpolating their glyph colour from a muted base to neon.
 *    - {@link useTrailHighlightOutlineStyle} — pill buttons glow by
 *      strengthening their border colour and casting a neon shadow.
 *
 * EdgeTrail no longer iterates a node list — it only publishes the two
 * shared values and draws the perimeter trail.
 */

/**
 * Perimeter geometry needed to map an element's rect to an arc-length
 * range. Published by {@link EdgeTrail}.
 */
export interface PerimeterGeometry {
  /** y of the bottom edge (where elements typically intersect). */
  y1: number;
  /** Left bound of the bottom edge's straight segment (x0 + r). */
  x0r: number;
  /** Right bound of the bottom edge's straight segment (x1 - r). */
  x1mr: number;
  /** Total perimeter length in pixels. */
  totalLength: number;
  /** t-value (0..1) at which the bottom edge starts along the path. */
  bottomStartT: number;
}

interface TrailContextValue {
  cometProgress: SharedValue<number>;
  geometry: SharedValue<PerimeterGeometry | null>;
  /**
   * Current trail colour, mirroring the comet's state (cyan in idle /
   * processing, magenta during recording). Highlighted elements
   * interpolate their border / glyph colour toward this so the whole
   * UI flushes magenta when the user is talking.
   */
  currentColor: SharedValue<string>;
  /** Fraction of the perimeter the comet's body spans. */
  trailLength: number;
}

const TrailContext = createContext<TrailContextValue | null>(null);

/** Must match {@link EdgeTrail.TRAIL_LENGTH}. */
const TRAIL_LENGTH = 0.28;
/** Re-measure cadence — JS-side `measureInWindow` on this interval. */
const REMEASURE_INTERVAL_MS = 250;

export function TrailHighlightProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const cometProgress = useSharedValue(0);
  const geometry = useSharedValue<PerimeterGeometry | null>(null);
  // Initial colour matches the trail's idle state (cyan neon). EdgeTrail
  // overwrites this every time its `state` prop changes.
  const currentColor = useSharedValue<string>('#00fff0');

  const value = useMemo<TrailContextValue>(
    () => ({
      cometProgress,
      geometry,
      currentColor,
      trailLength: TRAIL_LENGTH,
    }),
    [cometProgress, geometry, currentColor],
  );

  return (
    <TrailContext.Provider value={value}>{children}</TrailContext.Provider>
  );
}

function useTrailContext(): TrailContextValue | null {
  return useContext(TrailContext);
}

/**
 * Publisher accessor — returns the provider's shared values so
 * {@link EdgeTrail} can write `cometProgress` and `geometry` from its
 * own worklet.
 */
export function useTrailHighlightPublisher() {
  return useTrailContext();
}

/**
 * Element's measured rect, stored in a SharedValue so the worklet can
 * read it without a JS bridge call.
 */
interface MeasuredRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes a 0..1 glow intensity for an element from the global
 * `cometProgress`, the perimeter `geometry`, and the element's own
 * `measureInWindow` rect (refreshed by a coarse JS timer).
 *
 * Returns a `ref` to attach to the element via `ref={ref}` and
 * `glowIntensity` for use in `useAnimatedStyle`.
 */
function useTrailGlow(): {
  ref: React.MutableRefObject<View | null>;
  glowIntensity: SharedValue<number>;
} {
  const ctx = useTrailContext();
  const ref = useRef<View | null>(null);
  const glowIntensity = useSharedValue(0);
  const rect = useSharedValue<MeasuredRect | null>(null);

  // JS-side measure loop. Runs on mount, then on a coarse interval to
  // pick up parent layout changes without relying on `onLayout`. When
  // the element unmounts the effect's cleanup clears the interval, so
  // no phantom rect lingers.
  useEffect(() => {
    if (!ctx) return;
    const measure = () => {
      const node = ref.current;
      if (!node) {
        rect.value = null;
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          rect.value = { x, y, width, height };
        }
      });
    };
    // First measure on next macrotask so the freshly-mounted element
    // has had a chance to lay out.
    const initial = setTimeout(measure, 50);
    const id = setInterval(measure, REMEASURE_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
      rect.value = null;
    };
  }, [ctx, rect]);

  // The hot loop — runs on the UI thread on every cometProgress tick.
  // Reads cached rect + geometry, writes a 0..1 intensity.
  useDerivedValue(() => {
    const r = rect.value;
    const g = ctx?.geometry.value;
    if (!ctx || !r || !g) {
      glowIntensity.value = 0;
      return;
    }
    // The trail only runs around the perimeter — only the bottom edge
    // ever passes through an element (the top/left/right edges sit
    // inside the safe-area inset, beyond every measured rect).
    const top = r.y;
    const bottom = r.y + r.height;
    if (top >= g.y1 || bottom <= g.y1) {
      glowIntensity.value = 0;
      return;
    }
    const xRight = Math.min(r.x + r.width, g.x1mr);
    const xLeft = Math.max(r.x, g.x0r);
    if (xRight <= xLeft) {
      glowIntensity.value = 0;
      return;
    }

    // The bottom edge is traversed right-to-left, so `xRight` enters
    // first and `xLeft` exits last.
    const tEntry = g.bottomStartT + (g.x1mr - xRight) / g.totalLength;
    const tExit = g.bottomStartT + (g.x1mr - xLeft) / g.totalLength;
    // Lit while *any* of the comet body covers the range: body is
    // `[head - trailLength, head]`. Small ease-in/out at the edges
    // keeps the on/off from snapping.
    const fullStart = tEntry;
    const fullEnd = tExit + ctx.trailLength;
    const fade = 0.02;
    const h = ctx.cometProgress.value;

    if (h < fullStart - fade || h > fullEnd + fade) {
      glowIntensity.value = 0;
    } else if (h < fullStart) {
      glowIntensity.value = (h - (fullStart - fade)) / fade;
    } else if (h > fullEnd) {
      glowIntensity.value = 1 - (h - fullEnd) / fade;
    } else {
      glowIntensity.value = 1;
    }
  });

  return { ref, glowIntensity };
}

/** Fallback target colour when no provider is mounted. */
const DEFAULT_NEON = '#00fff0';

/**
 * Text-label glow. The label's glyph colour interpolates from `from`
 * (muted base) toward the trail's current colour as the comet sweeps
 * across it. The target colour follows the trail's state — cyan when
 * idle, magenta during recording — so the whole UI flushes the same
 * colour together.
 *
 * Attach `ref` to an `Animated.Text` and spread `colorStyle` into its
 * `style` prop.
 */
export function useTrailHighlightTextColor(from: string) {
  const ctx = useTrailContext();
  const { ref, glowIntensity } = useTrailGlow();
  const colorStyle = useAnimatedStyle(() => {
    const to = ctx?.currentColor.value ?? DEFAULT_NEON;
    return {
      color: interpolateColor(glowIntensity.value, [0, 1], [from, to]),
    };
  });
  return { ref, colorStyle, glowIntensity };
}

/**
 * Pill-control glow. Drives `borderColor` and an outer shadow so the
 * pill button visibly brightens as the comet passes through it. The
 * target colour follows the trail's current state (cyan idle, magenta
 * recording). Uses only RN style props (no Skia overlay) — z-order
 * with surrounding UI stays trivially correct and no node-list lives
 * in `EdgeTrail`.
 *
 * Attach `ref` to an `Animated.View` wrapping the pill, and spread
 * `borderStyle` into its `style` prop.
 */
export function useTrailHighlightOutlineStyle(from: string) {
  const ctx = useTrailContext();
  const { ref, glowIntensity } = useTrailGlow();
  const borderStyle = useAnimatedStyle(() => {
    const to = ctx?.currentColor.value ?? DEFAULT_NEON;
    return {
      borderColor: interpolateColor(glowIntensity.value, [0, 1], [from, to]),
      shadowColor: to,
      shadowOpacity: 0.6 * glowIntensity.value,
      shadowRadius: 6 + 10 * glowIntensity.value,
      shadowOffset: { width: 0, height: 0 },
    };
  });
  return { ref, borderStyle, glowIntensity };
}
