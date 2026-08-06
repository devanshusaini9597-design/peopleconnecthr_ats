import React from 'react';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

export default function KpiCard({ icon: Icon, label, value, sub, gradient, onClick, trend, loading }) {
  return (
  <button
    type="button"
    onClick={onClick}
    className="relative card-ats-bordered p-5 min-h-[118px] flex flex-col justify-between overflow-hidden text-left w-full group transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60 hover:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
  >
    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} transition-all duration-300 group-hover:h-1.5`} />
    <div
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0) 40%, rgba(0,0,0,0.02))' }}
    />
    <div className="relative flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-stone-500 text-sm font-medium truncate">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 tabular-nums tracking-tight">
          {loading ? '—' : value}
        </p>
        {trend !== undefined && trend !== null ? (
          <div className="flex items-center gap-1 mt-2">
            {trend >= 0
              ? <TrendingUp size={14} className="text-emerald-600 flex-shrink-0" />
              : <TrendingDown size={14} className="text-red-500 flex-shrink-0" />}
            <span className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? '+' : ''}{trend}% vs last month
            </span>
          </div>
        ) : sub ? (
          <p className="text-xs text-stone-500 mt-2 truncate">{sub}</p>
        ) : null}
      </div>
      <div className={`p-3 rounded-xl flex-shrink-0 bg-gradient-to-br ${gradient} shadow-md transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-3`}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
    <div className="relative mt-3 flex items-center gap-1 text-[11px] font-semibold text-stone-400 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
      View details <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
    </div>
  </button>
  );
}
