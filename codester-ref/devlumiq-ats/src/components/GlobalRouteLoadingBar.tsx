'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DURATION_MS = 320;

export function GlobalRouteLoadingBar() {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), DURATION_MS);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed top-0 left-0 right-0 h-0.5 bg-brand-500/20 z-[9998] overflow-hidden pointer-events-none"
          aria-hidden
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 0.85 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{ transformOrigin: 'left' }}
            className="h-full w-full bg-gradient-to-r from-brand-500 to-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.6)]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
