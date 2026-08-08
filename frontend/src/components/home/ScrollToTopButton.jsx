import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp } from 'lucide-react';

/** Floating control — portaled to body so overflow/clip on the page can't trap it. */
export function ScrollToTopButton({ visible, prefersReduced, onClick }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          key="scroll-top"
          initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          whileHover={prefersReduced ? undefined : { y: -4, scale: 1.06 }}
          whileTap={prefersReduced ? undefined : { scale: 0.94 }}
          onClick={onClick}
          aria-label="Scroll to top"
          className="scroll-top-btn"
        >
          <span className="scroll-top-btn__glow" aria-hidden="true" />
          <span className="scroll-top-btn__inner">
            <ChevronUp size={20} strokeWidth={2.5} />
          </span>
        </motion.button>
      )}
    </AnimatePresence>,
    document.body
  );
}
