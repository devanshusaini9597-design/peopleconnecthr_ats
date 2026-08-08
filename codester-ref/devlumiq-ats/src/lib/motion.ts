/**
 * Motion config — shared spring/tween presets.
 * Use transform + opacity only. No animation > 400ms.
 */

export const spring = {
  /** Snappy, native app feel */
  tight: { type: 'spring' as const, stiffness: 400, damping: 30 },
  /** Smooth, organic */
  smooth: { type: 'spring' as const, stiffness: 300, damping: 25 },
  /** Gentle bounce */
  gentle: { type: 'spring' as const, stiffness: 200, damping: 20 },
};

export const tween = {
  /** Fast — under 300ms */
  fast: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
  /** Standard — ~350ms */
  normal: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
  /** Max 400ms */
  slow: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
};

/** Stagger delay between list items (~80–100ms) */
export const staggerDelay = 0.08;
