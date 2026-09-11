import React from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { formatNameForInput } from '../../utils/textFormatter';

export default function PositionsComposePanel({
  draft,
  setDraft,
  creating,
  editing,
  onSubmit,
}) {
  return (
    <form
      data-tour="positions-compose"
      onSubmit={onSubmit}
      className="lg:col-span-4 card-ats-bordered p-5 sm:p-6 relative overflow-hidden space-y-4 h-fit lg:sticky lg:top-4 min-w-0"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative min-w-0">
        <h2 className="text-base font-bold text-stone-900 tracking-tight">Add position</h2>
        <p className="text-[11px] text-stone-400 mt-0.5">
          Shared across your organization — used on candidates and jobs.
        </p>
      </div>

      <div className="relative">
        <label className="label-ats" htmlFor="position-name">Position name *</label>
        <input
          id="position-name"
          value={draft}
          onChange={(e) => setDraft(formatNameForInput(e.target.value))}
          className="input-ats uppercase tracking-wide"
          placeholder="e.g. SALES EXECUTIVE"
          required
          disabled={!!editing}
        />
      </div>

      <button
        type="submit"
        disabled={creating || !draft.trim() || !!editing}
        className="btn-primary w-full relative"
      >
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add position
      </button>

      <p className="text-[11px] text-stone-500 leading-relaxed relative">
        Tip: keep role names consistent so filters and reports stay accurate.
      </p>
    </form>
  );
}
