import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { View } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { CircuitNode } from '../components/EdgeTrail';

/**
 * Spatial-registration context for {@link EdgeTrail}.
 *
 * Components that should react to the comet passing through them call
 * {@link useTrailHighlight} to receive a `ref` + `onLayout` pair *and* an
 * `activeness` shared value (0…1). The hook measures the element's
 * screen-coordinate rect and publishes it on the shared context;
 * {@link useTrailHighlightNodes} subscribes from inside `EdgeTrail` and
 * consumes the merged list to drive outline rendering. The shared
 * `activeness` is updated from inside EdgeTrail's animation worklet, so
 * components that want a fully custom visual (e.g. a text label that
 * brightens its own glyph colour rather than drawing a Skia overlay
 * behind itself) can drive any animated style from it.
 *
 * Split into two contexts on purpose:
 * - `ApiContext` exposes the stable `register` / `unregister` callbacks
 *   so the hook's mount-unmount effect does not re-fire each time
 *   *another* component registers (which it would if the API and data
 *   shared a single context value).
 * - `DataContext` carries the live node list — only consumers that
 *   actually need to re-render on changes (i.e. EdgeTrail) subscribe.
 */

type Kind = NonNullable<CircuitNode['kind']>;

export interface RegisteredNode extends CircuitNode {
  id: string;
  /**
   * 0 when the comet's body is nowhere near the rect, 1 when any part of
   * the body is over it. Driven from `EdgeTrail`'s animation worklet.
   */
  activeness: SharedValue<number>;
}

interface ApiValue {
  register: (id: string, rect: CircuitNode, activeness: SharedValue<number>) => void;
  unregister: (id: string) => void;
}

const ApiContext = createContext<ApiValue | null>(null);
const DataContext = createContext<RegisteredNode[]>([]);

export function TrailHighlightProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [byId, setById] = useState<Record<string, RegisteredNode>>({});

  const register = useCallback(
    (id: string, rect: CircuitNode, activeness: SharedValue<number>) => {
      setById(prev => {
        const existing = prev[id];
        if (
          existing &&
          existing.x === rect.x &&
          existing.y === rect.y &&
          existing.width === rect.width &&
          existing.height === rect.height &&
          existing.kind === rect.kind &&
          existing.activeness === activeness
        ) {
          return prev;
        }
        return { ...prev, [id]: { ...rect, id, activeness } };
      });
    },
    [],
  );

  const unregister = useCallback((id: string) => {
    setById(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const api = useMemo<ApiValue>(
    () => ({ register, unregister }),
    [register, unregister],
  );

  const nodes = useMemo(() => Object.values(byId), [byId]);

  return (
    <ApiContext.Provider value={api}>
      <DataContext.Provider value={nodes}>{children}</DataContext.Provider>
    </ApiContext.Provider>
  );
}

let highlightIdCounter = 0;
function nextHighlightId(): string {
  highlightIdCounter += 1;
  return `th-${highlightIdCounter}`;
}

/**
 * Opt in to the trail's intersection-highlight pass. Attach the returned
 * `ref` and `onLayout` to the element. While mounted, the element's
 * screen-coordinate rect is published on the shared context and the
 * `activeness` shared value is driven by EdgeTrail's animation worklet
 * (0 → 1 while the comet's body covers the element's arc-length range,
 * back to 0 when it leaves).
 *
 * `kind` chooses what EdgeTrail itself renders for the rect:
 * - `outline` (default) — stroke the rounded-rect border weighted by
 *   `activeness`. For controls that already have a visible outline
 *   (pill buttons), this intensifies their border as the comet passes.
 * - `text` — EdgeTrail renders *nothing* for this rect. The component
 *   wires `activeness` into its own animated style (typically an
 *   `Animated.Text` with an interpolated colour) so the glyphs glow
 *   neon while the comet passes through, instead of a rectangular halo
 *   behind them.
 */
export function useTrailHighlight(kind: Kind = 'outline') {
  const api = useContext(ApiContext);
  const ref = useRef<View>(null);
  const idRef = useRef<string>('');
  if (idRef.current === '') idRef.current = nextHighlightId();
  const id = idRef.current;
  // One shared value per registration — created once via `useSharedValue`
  // so the test environment's Reanimated mock can hand back a real
  // shared value (`makeMutable` is not part of the mock surface). The
  // worklet in EdgeTrail writes to it; the component reads from it.
  const activeness = useSharedValue(0);

  const onLayout = useCallback(() => {
    if (!api) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        api.register(id, { x, y, width, height, kind }, activeness);
      }
    });
  }, [api, id, kind, activeness]);

  useEffect(() => {
    return () => {
      api?.unregister(id);
    };
  }, [api, id]);

  return { ref, onLayout, activeness };
}

/**
 * Convenience for text labels. Returns the same `ref` / `onLayout` /
 * `activeness` as {@link useTrailHighlight}, plus an animated style that
 * interpolates the colour from `from` (the label's base colour) to `to`
 * (the trail's neon colour) as the comet's body sweeps over it. Wire it
 * into `Animated.Text`'s `style` prop and the glyphs themselves brighten
 * — no rectangular halo behind the text.
 */
export function useTrailHighlightTextColor(from: string, to: string) {
  const { ref, onLayout, activeness } = useTrailHighlight('text');
  const color = useDerivedValue(() =>
    interpolateColor(activeness.value, [0, 1], [from, to]),
  );
  const colorStyle = useAnimatedStyle(() => ({ color: color.value }));
  return { ref, onLayout, activeness, colorStyle };
}

/** Consume the merged list of currently-mounted, measured nodes. */
export function useTrailHighlightNodes(): RegisteredNode[] {
  return useContext(DataContext);
}
