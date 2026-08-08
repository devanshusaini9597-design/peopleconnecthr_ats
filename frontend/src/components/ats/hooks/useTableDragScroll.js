import { useRef } from 'react';

export function useTableDragScroll() {
  const tableScrollRef = useRef(null);
  const dragScrollRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });

  const isClickOnScrollbar = (el, e) => {
    const rect = el.getBoundingClientRect();
    const canScrollX = el.scrollWidth > el.clientWidth + 1;
    const canScrollY = el.scrollHeight > el.clientHeight + 1;
    const hBar = Math.max(el.offsetHeight - el.clientHeight, 0);
    const vBar = Math.max(el.offsetWidth - el.clientWidth, 0);
    if (canScrollX && e.clientY >= rect.bottom - Math.max(hBar, 16)) return true;
    if (canScrollY && e.clientX >= rect.right - Math.max(vBar, 16)) return true;
    return false;
  };

  const onTableDragScrollStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
    if (!e.target.closest('td, th, .cand-table-drag')) return;
    const el = tableScrollRef.current;
    if (!el) return;
    if (isClickOnScrollbar(el, e)) return;
    dragScrollRef.current = { active: true, moved: false, startX: e.pageX, scrollLeft: el.scrollLeft };
    el.dataset.dragging = '1';
  };

  const onTableDragScrollMove = (e) => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    const el = tableScrollRef.current;
    if (!el) return;
    e.preventDefault();
    const dx = e.pageX - state.startX;
    if (Math.abs(dx) > 3) state.moved = true;
    el.scrollLeft = state.scrollLeft - dx;
  };

  const onTableDragScrollEnd = () => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    state.active = false;
    const el = tableScrollRef.current;
    if (el) delete el.dataset.dragging;
  };

  return {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  };
}
