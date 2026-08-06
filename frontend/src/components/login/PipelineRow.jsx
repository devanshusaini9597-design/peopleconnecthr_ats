import React from 'react';
import { PIPELINE_STAGES } from './loginConstants';

export const PipelineRow = ({ name, role, stage }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.06] last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-medium text-white truncate">{name}</p>
      <p className="text-xs text-stone-400 truncate">{role}</p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
      {PIPELINE_STAGES.map((label, i) => (
        <span
          key={label}
          title={label}
          className={`h-1.5 rounded-full transition-all duration-700 ease-out ${
            i === stage
              ? 'w-5 bg-gradient-to-r from-brand-400 to-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.7)]'
              : i < stage
                ? 'w-1.5 bg-brand-400/40'
                : 'w-1.5 bg-white/10'
          }`}
        />
      ))}
    </div>
  </div>
);
