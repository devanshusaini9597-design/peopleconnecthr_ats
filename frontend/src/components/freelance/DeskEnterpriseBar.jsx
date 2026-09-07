import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, CheckCircle2, Loader2, Search, Trash2, Users, XCircle,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';

/**
 * SLA banner + bulk actions + placement strip for Freelance Desk Review.
 */
export default function DeskEnterpriseBar({
  rows = [],
  selectedIds = [],
  setSelectedIds,
  onBulk,
  bulkSaving = false,
  placement = null,
  canHardDelete = false,
  showArchived = false,
}) {
  const [bulkAction, setBulkAction] = useState('reviewing');

  const slaRows = useMemo(
    () => rows.filter((r) => r.slaBreached && !r.archivedAt),
    [rows]
  );

  const allIds = rows.map((r) => r._id).filter(Boolean);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  const bulkOptions = showArchived
    ? [
      { value: 'restore', label: 'Restore selected', icon: CheckCircle2 },
    ]
    : [
      { value: 'reviewing', label: 'Mark under review', icon: Search },
      { value: 'shortlisted', label: 'Move to shortlisting', icon: CheckCircle2 },
      { value: 'selection', label: 'Move to selection', icon: Users },
      { value: 'joined', label: 'Mark joined', icon: CheckCircle2 },
      { value: 'rejected', label: 'Decline selected', icon: XCircle },
      { value: 'archive', label: 'Archive selected', icon: Archive },
      ...(canHardDelete ? [{ value: 'hard_delete', label: 'Permanently delete…', icon: Trash2 }] : []),
    ];

  return (
    <div className="space-y-3 mb-5">
      {slaRows.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/60 px-4 py-3 flex flex-wrap items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 inline-flex items-center justify-center shrink-0">
            <AlertTriangle size={16} strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-950">
              {slaRows.length} submission{slaRows.length === 1 ? '' : 's'} past SLA
            </p>
            <p className="text-[12px] text-amber-800/90 mt-0.5">
              Still in Submitted or Under review beyond the agreed review window — prioritize these desks.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {slaRows.slice(0, 6).map((row) => (
                <span
                  key={row._id}
                  className="text-[11px] font-medium px-2 py-1 rounded-lg bg-white/80 border border-amber-200 text-amber-900"
                >
                  {row.candidateId?.name || 'Candidate'} · {row.agingDays}d
                </span>
              ))}
              {slaRows.length > 6 ? (
                <span className="text-[11px] text-amber-700 font-medium px-2 py-1">+{slaRows.length - 6} more</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {placement?.totals ? (
        <div className="rounded-2xl border border-stone-200/90 bg-white px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
          <span className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 inline-flex items-center justify-center">
            <Users size={14} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Placement summary</p>
            <p className="text-[13px] text-stone-800 font-semibold">
              {placement.totals.shortlisted}/{placement.totals.total} shortlisted
              <span className="text-stone-400 font-medium"> · {placement.totals.conversionRate}% conversion</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {(placement.desks || []).slice(0, 4).map((desk) => (
              <span
                key={desk.freelancerId}
                className="text-[11px] font-medium px-2 py-1 rounded-lg border border-stone-200 bg-stone-50 text-stone-700"
                title={`${desk.email || ''} · ${desk.conversionRate}%`}
              >
                {desk.name.split(' ')[0]} · {desk.shortlisted}/{desk.total}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-stone-200/90 bg-white px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-stone-700 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            checked={allSelected}
            onChange={(e) => setSelectedIds(e.target.checked ? allIds : [])}
          />
          Select all ({selectedIds.length})
        </label>
        <div className="w-full sm:w-56 min-w-0">
          <PremiumSelect
            compact
            value={bulkAction}
            onChange={setBulkAction}
            options={bulkOptions}
            icon={CheckCircle2}
          />
        </div>
        <button
          type="button"
          disabled={!selectedIds.length || bulkSaving}
          onClick={() => onBulk?.(bulkAction, selectedIds)}
          className="btn-primary disabled:opacity-50"
        >
          {bulkSaving ? <Loader2 size={14} className="animate-spin" /> : null}
          Apply action
        </button>
      </div>
    </div>
  );
}
