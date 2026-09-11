import React from 'react';

/**
 * Compact funnel KPI for Email Reports — avoids dashboard StatCard overflow
 * when six+ cards sit in one row.
 */
export default function FunnelMetricCard({
  icon: Icon,
  label,
  value,
  caption,
  gradient = 'from-brand-500 to-teal-400',
  loading,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      className={`relative flex h-full min-h-[108px] w-full min-w-[148px] max-w-full flex-col justify-between overflow-hidden rounded-2xl border bg-white px-3.5 py-3.5 text-left shadow-[var(--shadow-card)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        active
          ? 'border-brand-400 ring-2 ring-brand-500/30'
          : 'border-stone-200/80 hover:border-brand-200 hover:shadow-md'
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />

      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          {label}
        </p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm`}
        >
          <Icon size={15} className="text-white" strokeWidth={2.25} />
        </div>
      </div>

      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-stone-900">
        {loading ? '—' : typeof value === 'number' ? value.toLocaleString() : value}
      </p>

      {caption ? (
        <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-stone-400">
          {caption}
        </p>
      ) : (
        <span className="mt-1 block h-[1.375rem]" aria-hidden />
      )}
    </button>
  );
}
