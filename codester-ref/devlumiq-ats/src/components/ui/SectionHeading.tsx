'use client';

import { motion } from 'framer-motion';
import { tween } from '@/lib/motion';
import type { LucideIcon } from 'lucide-react';

interface SectionHeadingProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Use for animate-in (e.g. page load). Omit for viewport-based. */
  animate?: boolean;
  /** 'center' (default) or 'left' */
  align?: 'center' | 'left';
  className?: string;
}

/**
 * Unified section heading style:
 * - Teal square icon + bold title inline
 * - Grey subtitle below (optional)
 * - No duplicate tag/pill above
 */
export default function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  animate = false,
  align = 'center',
  className = '',
}: SectionHeadingProps) {
  const isLeft = align === 'left';
  const content = (
    <div className={isLeft ? `text-left ${className}` : `text-center ${className}`}>
      <h2 className={`text-2xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 tracking-tight flex items-center gap-3 flex-wrap ${isLeft ? 'justify-start' : 'justify-center'}`}>
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </span>
        {title}
      </h2>
      {subtitle && (
        <p className={`text-base sm:text-lg text-stone-600 mt-3 sm:mt-4 max-w-2xl ${isLeft ? '' : 'mx-auto'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tween.normal}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={tween.normal}
    >
      {content}
    </motion.div>
  );
}
