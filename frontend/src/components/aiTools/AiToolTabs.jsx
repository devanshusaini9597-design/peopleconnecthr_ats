import React from 'react';
import FeatureGate from '../FeatureGate';
import { TABS } from './aiToolsConstants';

export default function AiToolTabs({ activeTab, onSelect }) {
  return (
    <div data-tour="ai-tabs" className="card-ats-bordered p-3 sm:p-3.5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <FeatureGate key={t.id} feature={t.feature}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold border transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-500/20'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/40'
              }`}
            >
              <t.icon size={14} className="flex-shrink-0" />
              <span>{t.label}</span>
            </button>
          </FeatureGate>
        ))}
      </div>
    </div>
  );
}
