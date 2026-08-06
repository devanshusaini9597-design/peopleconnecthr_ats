import React from 'react';
import { Lock } from 'lucide-react';

export const UpgradeStrip = ({ message }) => (
  <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-amber-200/80 bg-amber-50/50 text-xs text-amber-900">
    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
    <span className="flex-1 min-w-0">{message}</span>
    <a href="/billing" className="font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
      View Plans
    </a>
  </div>
);

export default UpgradeStrip;
