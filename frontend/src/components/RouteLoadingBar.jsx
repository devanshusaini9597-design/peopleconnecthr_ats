import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

const DURATION_MS = 360;

/**
 * Thin brand progress bar on route change — AJAX / SPA feel without full reload.
 */
const RouteLoadingBar = () => {
  const { pathname, search } = useLocation();
  const prevRef = useRef(`${pathname}${search}`);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = `${pathname}${search}`;
    if (key === prevRef.current) return undefined;
    prevRef.current = key;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), DURATION_MS);
    return () => clearTimeout(t);
  }, [pathname, search]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed top-0 left-0 right-0 h-0.5 bg-brand-500/15 z-[9998] overflow-hidden pointer-events-none"
          aria-hidden
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 0.88 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            style={{ transformOrigin: 'left' }}
            className="h-full w-full bg-gradient-to-r from-brand-500 via-teal-400 to-brand-300 shadow-[0_0_12px_rgba(20,184,166,0.55)]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RouteLoadingBar;
