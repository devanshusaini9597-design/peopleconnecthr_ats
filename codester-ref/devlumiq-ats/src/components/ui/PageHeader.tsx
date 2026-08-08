'use client';

import { type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-side actions (CTA, etc.) - optional */
  children?: React.ReactNode;
}

export default function PageHeader({ icon: Icon, title, subtitle, children }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-4"
    >
      <div className="flex items-start gap-4">
        {/* Icon — gradient + subtle ring */}
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 flex items-center justify-center shadow-lg shadow-brand-500/20 ring-1 ring-white/20 ring-inset flex-shrink-0">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-sm" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 tracking-tight leading-tight" style={{ letterSpacing: '-0.025em' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-stone-500 text-sm sm:text-base mt-1.5 font-medium" style={{ letterSpacing: '0.01em' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children && <div className="flex-shrink-0 min-w-0 flex flex-wrap items-center gap-2">{children}</div>}
    </motion.div>
  );
}
