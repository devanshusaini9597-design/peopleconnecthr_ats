import React, { useMemo } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';
import { DATE_RANGE_OPTIONS } from './constants';

export default function AnalyticsPeriodSelect({
  dateRange,
  setDateRange,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  periodLabel = '',
  className = '',
}) {
  const rangeError = useMemo(() => {
    if (dateRange !== 'custom') return '';
    if (!customFrom || !customTo) return '';
    if (customFrom > customTo) return 'End date must be on or after the start date.';
    return '';
  }, [dateRange, customFrom, customTo]);

  const handleFrom = (value) => {
    setCustomFrom(value);
    if (value && customTo && value > customTo) setCustomTo('');
  };

  const handleTo = (value) => {
    if (value && customFrom && value < customFrom) return;
    setCustomTo(value);
  };

  return (
    <div className={`min-w-0 w-full ${className}`} data-tour="analytics-period">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
          Time period
        </label>
        {periodLabel ? (
          <span className="inline-flex items-center max-w-full rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-800 tabular-nums">
            <span className="truncate">{periodLabel}</span>
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <PremiumSelect
          variant="list"
          value={dateRange}
          onChange={setDateRange}
          options={DATE_RANGE_OPTIONS}
          icon={Calendar}
          placeholder="Select period"
          menuMinWidth={240}
        />

        {dateRange === 'custom' && (
          <div className="rounded-xl border border-stone-200 bg-gradient-to-br from-white to-stone-50/80 p-3.5 sm:p-4 space-y-3 shadow-sm shadow-stone-200/40">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-brand-50 border border-brand-100 text-brand-700 inline-flex items-center justify-center flex-shrink-0">
                <Calendar size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900">Custom date range</p>
                <p className="text-[11px] text-stone-500">Choose a start and end date for this report.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="block text-[11px] font-medium text-stone-500 mb-1.5">Start date</label>
                <PremiumDatePicker
                  value={customFrom}
                  onChange={handleFrom}
                  placeholder="Select start"
                  allowClear
                  maxDate={customTo || undefined}
                  error={Boolean(rangeError)}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-medium text-stone-500 mb-1.5">End date</label>
                <PremiumDatePicker
                  value={customTo}
                  onChange={handleTo}
                  placeholder="Select end"
                  allowClear
                  minDate={customFrom || undefined}
                  error={Boolean(rangeError)}
                />
              </div>
            </div>

            {rangeError ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{rangeError}</span>
              </div>
            ) : customFrom && customTo ? (
              <p className="text-[11px] text-stone-500 tabular-nums">
                {new Date(customFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                {' — '}
                {new Date(customTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            ) : (
              <p className="text-[11px] text-stone-400">Select both dates to load metrics for this range.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
