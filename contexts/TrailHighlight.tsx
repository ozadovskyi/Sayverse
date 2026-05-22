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
 * This replaces the earlier "manual prop drilling" pattern where each
 * highlightable rect was a separate `useMeasuredRect` in App.tsx with its
 * ref piped through `labelRef` / `buttonRef` / etc. props on intermediate
 * components. With the context in place, a new highlightable element
 * registers itself in one line and App.tsx does not need to know about
 * it.
 */

type Kind = NonNullable<CircuitNode['kind']>;

interface TrailHighlightContextValue {
  register: (id: string, rect: CircuitNode) => void;
  unregister: (id: string) => void;
  nodes: CircuitNode[];
}

const TrailHighlightContext = createContext<TrailHighlightContextValue | null>(
  null,
);

export function TrailHighlightProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Keyed by registration id so register-replaces-on-relayout is a single
  // entry update, not a list scan. Consumers see the merged array.
  const [byId, setById] = useState<Record<string, CircuitNode>>({});

  const register = useCallback((id: string, rect: CircuitNode) => {
    setById(prev => {
      const existing = prev[id];
      // Avoid a state update when the rect did not change — measureInWindow
      // can fire on every render via onLayout and we'd churn through the
      // tree for nothing.
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

  const value = useMemo<TrailHighlightContextValue>(
    () => ({ register, unregister, nodes: Object.values(byId) }),
    [register, unregister, byId],
  );

  return (
    <TrailHighlightContext.Provider value={value}>
      {children}
    </TrailHighlightContext.Provider>
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
  const ctx = useContext(TrailHighlightContext);
  const ref = useRef<View>(null);
  const idRef = useRef<string>('');
  if (idRef.current === '') idRef.current = nextHighlightId();
  const id = idRef.current;

  const onLayout = useCallback(() => {
    if (!ctx) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        ctx.register(id, { x, y, width, height, kind });
      }
    });
  }, [ctx, id, kind]);

  useEffect(() => {
    return () => {
      ctx?.unregister(id);
    };
  }, [ctx, id]);

  return { ref, onLayout };
}

/** Consume the merged list of currently-mounted, measured nodes. */
export function useTrailHighlightNodes(): CircuitNode[] {
  return useContext(TrailHighlightContext)?.nodes ?? [];
}
