import React from 'react';
import { Layers, Users, Briefcase } from 'lucide-react';

export default function SkillsGuide() {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200/80 bg-gradient-to-br from-brand-50/50 via-white to-teal-50/40 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white border border-brand-100 shadow-sm flex items-center justify-center flex-shrink-0">
          <Layers className="w-5 h-5 text-brand-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-stone-900 tracking-tight">How skills are used</p>
          <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
            Keep the catalog structured — matching works best with clear, reusable names.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-stone-200/80 bg-white/90 px-3 py-2.5 flex items-start gap-2.5 shadow-sm">
          <Users className="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-stone-800">Candidates</p>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
              Attach skills with proficiency when profiling talent.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200/80 bg-white/90 px-3 py-2.5 flex items-start gap-2.5 shadow-sm">
          <Briefcase className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-stone-800">Jobs</p>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
              Require skills on roles, then score shortlists with match %.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
