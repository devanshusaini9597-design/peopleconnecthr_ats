import { useLayoutEffect, useRef, useState } from 'react';

let stack = [];
const listeners = new Set();

function emit() {
  const top = stack[stack.length - 1] || null;
  listeners.forEach((fn) => fn(top));
}

/**
 * Nested overlay stack so only the top modal traps focus / Escape.
 * Parent dialogs disable their focus lock instead of stealing keystrokes
 * from Manage / confirm dialogs portaled to document.body.
 */
export default function useModalLayer(open) {
  const idRef = useRef(null);
  if (idRef.current == null) {
    idRef.current = `modal-${Math.random().toString(36).slice(2, 10)}`;
  }
  const id = idRef.current;
  const [topId, setTopId] = useState(() => stack[stack.length - 1] || null);

  useLayoutEffect(() => {
    const sync = (next) => setTopId((prev) => (prev === next ? prev : next));
    listeners.add(sync);
    return () => listeners.delete(sync);
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    stack.push(id);
    emit();
    return () => {
      stack = stack.filter((item) => item !== id);
      emit();
    };
  }, [open, id]);

  return {
    isTop: !open || topId === id || !stack.includes(id),
  };
}
