import { useCallback, useRef } from 'react';

/**
 * Horizontal click-drag scroll without relying on a visible scrollbar.
 * Set allowOnInteractive=true to drag starting on buttons/cards (KPI strips).
 */
export default function useHorizontalDragScroll({ allowOnInteractive = false } = {}) {
  const scrollRef = useRef(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: null,
  });

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (
        !allowOnInteractive &&
        e.target.closest('button, a, input, select, textarea, label, [role="button"]')
      ) {
        return;
      }
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollWidth <= el.clientWidth + 1) return;

      dragRef.current = {
        active: true,
        moved: false,
        startX: e.pageX,
        scrollLeft: el.scrollLeft,
        pointerId: e.pointerId,
      };
      el.dataset.dragging = '1';
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [allowOnInteractive]
  );

  const onPointerMove = useCallback((e) => {
    const state = dragRef.current;
    if (!state.active) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.pageX - state.startX;
    if (Math.abs(dx) > 4) {
      state.moved = true;
      e.preventDefault();
    }
    el.scrollLeft = state.scrollLeft - dx;
  }, []);

  const endDrag = useCallback((e) => {
    const state = dragRef.current;
    if (!state.active) return;
    state.active = false;
    const el = scrollRef.current;
    if (el) {
      delete el.dataset.dragging;
      try {
        if (e?.pointerId != null) el.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }, []);

  /** Call from click handlers — returns true if this was a drag, not a click. */
  const didDrag = useCallback(() => {
    const moved = dragRef.current.moved;
    dragRef.current.moved = false;
    return moved;
  }, []);

  return {
    scrollRef,
    didDrag,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
