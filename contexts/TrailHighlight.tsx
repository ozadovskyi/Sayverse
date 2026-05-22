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

import type { CircuitNode } from '../components/EdgeTrail';

/**
 * Spatial-registration context for {@link EdgeTrail}.
 *
 * Components that should light up when the perimeter passes through them
 * call {@link useTrailHighlight} to receive a `ref` + `onLayout` pair. The
 * hook measures the element's screen-coordinate rect and publishes it on
 * the shared context; {@link useTrailHighlightNodes} subscribes from
 * inside `EdgeTrail` and consumes the merged list.
 *
 * Split into two contexts on purpose:
 * - `ApiContext` exposes the stable `register` / `unregister` callbacks
 *   so the hook's mount-unmount effect does not re-fire each time
 *   *another* component registers (which it would if the API and data
 *   shared a single context value).
 * - `DataContext` carries the live node list — only consumers that
 *   actually need to re-render on changes (i.e. EdgeTrail) subscribe.
 *
 * This replaces the earlier "manual prop drilling" pattern where each
 * highlightable rect was a separate `useMeasuredRect` in App.tsx with its
 * ref piped through `labelRef` / `buttonRef` / etc. props on intermediate
 * components.
 */

type Kind = NonNullable<CircuitNode['kind']>;

interface ApiValue {
  register: (id: string, rect: CircuitNode) => void;
  unregister: (id: string) => void;
}

const ApiContext = createContext<ApiValue | null>(null);
const DataContext = createContext<CircuitNode[]>([]);

export function TrailHighlightProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Keyed by registration id so register-replaces-on-relayout is a single
  // entry update, not a list scan.
  const [byId, setById] = useState<Record<string, CircuitNode>>({});

  const register = useCallback((id: string, rect: CircuitNode) => {
    setById(prev => {
      const existing = prev[id];
      // Skip state updates when nothing changed — measureInWindow can
      // fire from onLayout on every render, and we don't want the
      // resulting register call to churn the consumer tree.
      if (
        existing &&
        existing.x === rect.x &&
        existing.y === rect.y &&
        existing.width === rect.width &&
        existing.height === rect.height &&
        existing.kind === rect.kind
      ) {
        return prev;
      }
      return { ...prev, [id]: rect };
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setById(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // The API is reference-stable across renders — callbacks are
  // `useCallback`-empty. Hooks that consume it (via `useTrailHighlight`)
  // don't get their mount-unmount effect re-fired when other components
  // register or unregister.
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
 * screen-coordinate rect is published on the shared context and the trail
 * will glow over it when the perimeter intersects.
 *
 * `kind` controls the visual:
 * - `outline` (default) — stroke the rounded-rect border. For controls
 *   that already have a visible outline (pill buttons).
 * - `glow` — paint a heavily-blurred fill behind the rect. For bare text
 *   labels without a border of their own.
 */
export function useTrailHighlight(kind: Kind = 'outline') {
  const api = useContext(ApiContext);
  const ref = useRef<View>(null);
  const idRef = useRef<string>('');
  if (idRef.current === '') idRef.current = nextHighlightId();
  const id = idRef.current;

  const onLayout = useCallback(() => {
    if (!api) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        api.register(id, { x, y, width, height, kind });
      }
    });
  }, [api, id, kind]);

  useEffect(() => {
    return () => {
      api?.unregister(id);
    };
  }, [api, id]);

  return { ref, onLayout };
}

/** Consume the merged list of currently-mounted, measured nodes. */
export function useTrailHighlightNodes(): CircuitNode[] {
  return useContext(DataContext);
}
