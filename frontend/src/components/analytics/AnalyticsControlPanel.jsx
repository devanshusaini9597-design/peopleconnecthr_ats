import React from 'react';
import { BarChart3, Download, Filter } from 'lucide-react';
import EmployeeScopeSelect from './EmployeeScopeSelect';
import AnalyticsPeriodSelect from './AnalyticsPeriodSelect';

const TABS = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'export', label: 'Export', icon: Download },
];

export default function AnalyticsControlPanel({
  employeeScope,
  isFreelancer,
  activeTab,
  setActiveTab,
  statsLoading = false,
  dateRange,
  setDateRange,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  periodLabel,
}) {
  const showScope = employeeScope.canSelect;
  const showTabs = !isFreelancer;
  const showPeriod = isFreelancer || activeTab === 'analytics' || activeTab === 'export';

  return (
    <section className="card-ats-bordered relative overflow-hidden" data-tour="analytics-tip">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

      {showTabs && (
        <div className="p-3 sm:p-4 border-b border-stone-100 bg-stone-50/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500">
              <Filter size={14} className="text-brand-600" />
              View
            </div>
            <nav
              data-tour="analytics-tabs"
              className="flex gap-1 p-1 bg-stone-100/90 rounded-xl overflow-x-auto scrollbar-hide w-full sm:w-auto"
              aria-label="Analytics views"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-1 sm:flex-none min-w-[120px] ${
                      active
                        ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80'
                        : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50/80'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : ''}`} strokeWidth={active ? 2.25 : 2} />
                    {tab.label}
                    {active && <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-brand-500" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {showPeriod && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className={`grid grid-cols-1 gap-5 ${showScope ? 'xl:grid-cols-2' : ''}`}>
            {showScope && (
              <EmployeeScopeSelect
                value={employeeScope.employeeParam}
                employees={employeeScope.employees}
                onChange={employeeScope.setEmployee}
                loading={employeeScope.loadingEmployees}
                statsLoading={statsLoading}
              />
            )}

            <AnalyticsPeriodSelect
              dateRange={dateRange}
              setDateRange={setDateRange}
              customFrom={customFrom}
              setCustomFrom={setCustomFrom}
              customTo={customTo}
              setCustomTo={setCustomTo}
              periodLabel={periodLabel}
            />
          </div>
        </div>
      )}
    </section>
  );
}
