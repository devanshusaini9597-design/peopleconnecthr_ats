import React from 'react';
import { Filter } from 'lucide-react';
import AnalyticsPeriodSelect from '../analytics/AnalyticsPeriodSelect';
import { canViewOrgAnalytics } from '../../utils/analyticsScope';

export default function DashboardPeriodBar({
  userRole,
  dateRange,
  setDateRange,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  periodLabel,
  scope,
}) {
  const isManager = canViewOrgAnalytics(userRole);

  return (
    <section className="card-ats-bordered relative overflow-hidden" data-tour="dash-period">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 mb-1">
              <Filter size={14} className="text-brand-600" />
              Reporting period
            </div>
            <p className="text-sm font-semibold text-stone-900">
              {periodLabel || 'All Time'}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
              Total Candidates is all-time.
              {scope === 'organization'
                ? ' Stage cards follow the selected period.'
                : ' Stage cards are your assigned candidates for the selected period.'}
              {isManager && (
                <>
                  {' '}
                  To view one employee&apos;s metrics, open{' '}
                  <span className="font-semibold text-brand-700">Reports &amp; Analytics</span>.
                </>
              )}
            </p>
          </div>
          <div className="w-full lg:max-w-md flex-shrink-0">
            <AnalyticsPeriodSelect
              dateRange={dateRange}
              setDateRange={setDateRange}
              customFrom={customFrom}
              setCustomFrom={setCustomFrom}
              customTo={customTo}
              setCustomTo={setCustomTo}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
