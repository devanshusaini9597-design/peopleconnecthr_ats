'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Tailwind classes for icon wrapper, e.g. "text-brand-600 bg-brand-50" */
  iconClassName?: string;
  className?: string;
  /** Optional small helper under the label */
  sub?: React.ReactNode;
  /** Optional % trend vs previous period */
  trend?: number | null;
  trendLabel?: string;
  onClick?: () => void;
}

/**
 * Shared dashboard stat tile — same padding, type, border, and icon size everywhere.
 */
export default function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName = 'text-brand-600 bg-brand-50',
  className = '',
  sub,
  trend,
  trendLabel,
  onClick,
}: StatCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={`card-ats-bordered p-4 flex items-center gap-3 min-w-0 ${onClick ? 'cursor-pointer hover:border-stone-300 transition-colors' : ''} ${className}`}
    >
      {Icon && (
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconClassName}`}>
          <Icon className="w-4 h-4" strokeWidth={2.25} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold text-stone-900 tracking-tight truncate tabular-nums">{value}</p>
        <p className="text-xs text-stone-500 truncate">{label}</p>
        {trend !== undefined && trend !== null && (
          <div className="flex items-center gap-1 mt-0.5 min-w-0">
            {trend >= 0
              ? <TrendingUp className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              : <TrendingDown className="w-3 h-3 text-red-500 flex-shrink-0" />}
            <span className={`text-[11px] font-semibold truncate ${trend >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend}%{trendLabel ? ` ${trendLabel}` : ''}
            </span>
          </div>
        )}
        {sub != null && sub !== '' && (
          <p className="text-[11px] text-stone-400 mt-0.5 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}
