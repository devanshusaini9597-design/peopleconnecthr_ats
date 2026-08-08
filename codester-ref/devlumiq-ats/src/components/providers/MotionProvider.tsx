'use client';

import { MotionConfig } from 'framer-motion';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {children}
    </MotionConfig>
  );
}
