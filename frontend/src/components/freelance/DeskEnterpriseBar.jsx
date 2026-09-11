import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, CheckCircle2, Loader2, Search, Trash2, Users, XCircle,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';

/**
 * Premium ops strip: SLA + placement badges (clickable desk filter) + bulk actions.
 */
export default function DeskEnterpriseBar({
  rows = [],
  selectedIds = [],
  setSelectedIds,
  onBulk,
  bulkSaving = false,
  placement = null,
  canHardDelete = false,
  canManageDesk = false,
  showArchived = false,
  deskFilter = 'all',
  setDeskFilter,
}) {
  const [bulkAction, setBulkAction] = useState(showArchived ? 'restore' : 'reviewing');

  const slaRows = useMemo(
    () => rows.filter((r) => r.slaBreached && !r.archivedAt),
    [rows]
  );

  const allIds = rows.map((r) => r._id).filter(Boolean);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  const bulkOptions = showArchived
    ? (canManageDesk ? [{ value: 'restore', label: 'Restore selected', icon: CheckCircle2 }] : [])
    : [
      { value: 'reviewing', label: 'Mark under review', icon: Search },
      { value: 'shortlisted', label: 'Move to shortlisting', icon: CheckCircle2 },
      { value: 'selection', label: 'Move to selection', icon: Users },
      { value: 'joined', label: 'Mark joined', icon: CheckCircle2 },
      { value: 'rejected', label: 'Decline selected', icon: XCircle },
      ...(canManageDesk ? [{ value: 'archive', label: 'Archive selected', icon: Archive }] : []),
      ...(canHardDelete ? [{ value: 'hard_delete', label: 'Permanently delete…', icon: Trash2 }] : []),
    ];

  if (!slaRows.length && !placement?.totals && !bulkOptions.length) {
    return null;
  }

  return (
    <div className="mb-3 space-y-2">
      {slaRows.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 text-amber-800">
            <AlertTriangle size={14} strokeWidth={2.25} />
          </span>
          <p className="text-[12px] font-semibold text-amber-950">
            {slaRows.length} past SLA
          </p>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {slaRows.slice(0, 4).map((row) => (
              <span
                key={row._id}
                className="inline-flex items-center h-6 px-2 rounded-md bg-white border border-amber-200 text-[10px] font-semibold text-amber-900"
              >
                {row.candidateId?.name || 'Candidate'} · {row.agingDays}d
              </span>
            ))}
            {slaRows.length > 4 ? (
              <span className="text-[10px] text-amber-700 font-semibold">+{slaRows.length - 4}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 flex flex-wrap items-center gap-2.5">
          {placement?.totals ? (
            <div className="inline-flex flex-wrap items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg bg-brand-50 border border-brand-100 text-brand-800">
                <Users size={13} />
                <span className="text-[10px] font-bold uppercase tracking-wide">Placement</span>
                <span className="text-[12px] font-bold tabular-nums">
                  {placement.totals.shortlisted}/{placement.totals.total}
                </span>
                <span className="text-[11px] font-semibold text-brand-600/80">
                  {placement.totals.conversionRate}%
                </span>
              </span>
              {(placement.desks || []).slice(0, 5).map((desk) => {
                const id = String(desk.freelancerId || '');
                const active = deskFilter === id;
                return (
                  <button
                    key={id || desk.name}
                    type="button"
                    onClick={() => setDeskFilter?.(active ? 'all' : id)}
                    className={`inline-flex items-center max-w-[11rem] sm:max-w-none h-7 px-2 rounded-lg border text-[10px] font-semibold transition-colors ${
                      active
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
                    }`}
                    title={`${desk.email || desk.name || 'Recruiter'} · ${desk.conversionRate}% conversion`}
                  >
                    <span className="truncate">
                      {String(desk.name || 'Desk').split(' ')[0]} · {desk.shortlisted}/{desk.total}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 ml-auto min-w-0">
            <label className="inline-flex items-center gap-1.5 h-8 px-2 rounded-lg border border-stone-200 bg-stone-50 text-[11px] font-semibold text-stone-600 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={allSelected}
                onChange={(e) => setSelectedIds(e.target.checked ? allIds : [])}
              />
              {selectedIds.length || 0} selected
            </label>
            {bulkOptions.length ? (
              <>
                <div className="w-[190px] sm:w-52 min-w-0">
                  <PremiumSelect
                    compact
                    value={bulkAction}
                    onChange={setBulkAction}
                    options={bulkOptions}
                    icon={CheckCircle2}
                    menuMinWidth={240}
                  />
                </div>
                <button
                  type="button"
                  disabled={!selectedIds.length || bulkSaving}
                  onClick={() => onBulk?.(bulkAction, selectedIds)}
                  className="h-9 px-3.5 rounded-lg text-[12px] font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
                >
                  {bulkSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                  Apply
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
