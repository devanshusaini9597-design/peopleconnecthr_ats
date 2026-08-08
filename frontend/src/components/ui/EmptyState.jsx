import React from 'react';
import { Inbox } from 'lucide-react';

const TONES = {
  neutral: 'from-stone-100 to-stone-50 border-stone-200/80 text-stone-400',
  brand: 'from-brand-50 to-teal-50 border-brand-200/70 text-brand-500',
  violet: 'from-violet-50 to-fuchsia-50 border-violet-200/70 text-violet-500',
  emerald: 'from-emerald-50 to-lime-50 border-emerald-200/70 text-emerald-500',
  amber: 'from-amber-50 to-orange-50 border-amber-200/70 text-amber-500',
  sky: 'from-sky-50 to-cyan-50 border-sky-200/70 text-sky-500',
};

/**
 * Enterprise empty state — contextual icon + optional CTA.
 * tone: 'neutral' | 'brand' | 'violet' | 'emerald' | 'amber' | 'sky'
 * compact: smaller padding/icon for cards, tables, and chart placeholders
 */
const EmptyState = ({
  message,
  subMessage,
  icon: Icon = Inbox,
  action,
  tone = 'neutral',
  compact = false,
  className = '',
}) => {
  const toneClass = TONES[tone] || TONES.neutral;
  return (
    <div
      className={`flex flex-col items-center justify-center text-center animate-fade-in ${
        compact ? 'py-6 px-4' : 'py-12 sm:py-16 px-6'
      } ${className}`}
      role="status"
      aria-label={message}
    >
      <div
        className={`${
          compact ? 'w-11 h-11 mb-3' : 'w-14 h-14 mb-4'
        } rounded-2xl bg-gradient-to-br border flex items-center justify-center shadow-sm ${toneClass}`}
      >
        <Icon className={compact ? 'w-5 h-5' : 'w-7 h-7'} strokeWidth={1.75} />
      </div>
      <p className={`text-stone-800 font-bold tracking-tight ${compact ? 'text-sm' : ''}`}>{message}</p>
      {subMessage && (
        <p className={`text-stone-500 mt-1.5 max-w-sm leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>{subMessage}</p>
      )}
      {action && <div className={compact ? 'mt-3' : 'mt-5'}>{action}</div>}
    </div>
  );
};

export default EmptyState;
