import React from 'react';
import { Download } from 'lucide-react';
import EmptyState from '../ui/EmptyState';

export function StatCard({ icon: Icon, label, value, sub, gradient, loading }) {
  return (
    <div className="relative card-ats-bordered p-5 min-h-[118px] flex flex-col justify-between overflow-hidden text-left w-full group transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} transition-all duration-300 group-hover:h-1.5`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-stone-500 text-sm font-medium truncate">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 tabular-nums tracking-tight truncate">
            {loading ? '—' : value}
          </p>
          {sub && <p className="text-xs text-stone-400 mt-1.5 font-medium truncate">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 bg-gradient-to-br ${gradient} shadow-md transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-3`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export function ReportCard({ title, icon: Icon, onExport, exportDisabled, children, className = '' }) {
  return (
    <div className={`card-ats-bordered p-5 sm:p-6 relative overflow-hidden min-w-0 ${className}`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/70 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-brand-600" />
          </div>
          <h2 className="text-base font-bold text-stone-900 tracking-tight truncate">{title}</h2>
        </div>
        {onExport && (
          <button
            type="button"
            className="btn-secondary !py-1.5 !text-xs w-full sm:w-auto"
            onClick={onExport}
            disabled={exportDisabled}
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function BreakdownBars({ rows, labelKey, valueKey, colors, emptyIcon: EmptyIcon, emptyMessage }) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  if (!rows.length) {
    return <EmptyState icon={EmptyIcon} tone="amber" compact message={emptyMessage} />;
  }
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const value = Number(r[valueKey]) || 0;
        const pct = Math.max((value / max) * 100, value > 0 ? 4 : 0);
        return (
          <div key={`${r[labelKey]}-${i}`} className="rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-stone-50 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1.5 min-w-0">
              <span className="text-sm font-medium text-stone-700 truncate min-w-0">{r[labelKey] || '—'}</span>
              <span className="text-sm font-bold text-stone-900 tabular-nums flex-shrink-0">{value}</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`${colors[i % colors.length]} h-2.5 rounded-full transition-all duration-700 ease-out`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
