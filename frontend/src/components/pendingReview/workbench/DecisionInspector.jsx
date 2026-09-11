import React from 'react';
import {
  AlertTriangle, Ban, CheckCircle2, ClipboardPen, FileSearch, Sparkles, Upload,
} from 'lucide-react';
import { REQUIRED_RELEASE_FIELDS } from './workbenchConstants';
import { getReadiness, getRowFixes, getRowIssues, initials } from './workbenchHelpers';
import StatusChip from './StatusChip';
import { isImportReady } from '../pendingReviewHelpers';

function fieldOk(row, key) {
  if (key === 'email') {
    const email = String(row?.email || '').trim();
    return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));
  }
  if (key === 'contact') {
    return String(row?.contact || '').replace(/\D/g, '').length >= 10;
  }
  return Boolean(String(row?.[key] || '').trim());
}

export default function DecisionInspector({
  row,
  isImporting,
  onFix,
  onRelease,
  onDiscard,
}) {
  if (!row) {
    return (
      <div
        data-tour="wb-inspector"
        className="h-full min-h-[480px] bg-stone-50/40 border-l border-stone-200 flex flex-col items-center justify-center p-8 text-center"
      >
        <div className="icon-box-ats mb-4">
          <FileSearch strokeWidth={2.25} />
        </div>
        <h3 className="text-base font-semibold text-stone-900">Select a record to decide</h3>
        <p className="text-sm text-stone-500 mt-1.5 max-w-xs leading-relaxed">
          Open any row from the queue. Review the checklist and issues, then fix, release, or discard.
        </p>
      </div>
    );
  }

  const readiness = getReadiness(row);
  const issues = getRowIssues(row);
  const fixes = getRowFixes(row);
  const ready = isImportReady(row);

  return (
    <div data-tour="wb-inspector" className="h-full min-h-[480px] bg-white border-l border-stone-200 flex flex-col">
      <div className="px-4 sm:px-5 py-4 border-b border-stone-200 shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
            {initials(row.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-stone-900 truncate">{row.name || 'Unnamed record'}</h3>
              <StatusChip tone={readiness.tone}>{readiness.label}</StatusChip>
            </div>
            <p className="text-sm text-stone-500 mt-0.5 truncate">{row.email || 'No email on file'}</p>
            <p className="text-xs text-stone-400 mt-1 truncate">
              {[row.companyName, row.position, row.contact].filter(Boolean).join(' · ') || 'Incomplete profile'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Release checklist</h4>
          <ul className="space-y-1.5">
            {REQUIRED_RELEASE_FIELDS.map((f) => {
              const ok = fieldOk(row, f.key);
              return (
                <li
                  key={f.key}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                    ok ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-100 bg-red-50/40'
                  }`}
                >
                  <span className="font-medium text-stone-800">{f.label}</span>
                  {ok ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700">
                      <AlertTriangle className="w-3.5 h-3.5" /> Missing
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
            Validation issues ({issues.length})
          </h4>
          {issues.length === 0 ? (
            <p className="text-sm text-stone-500 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5">
              No validation flags on this row.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {issues.map((issue, i) => (
                <li key={`${issue}-${i}`} className="flex gap-2 text-sm text-red-800 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="leading-snug">{issue}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {fixes.length > 0 && (
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
              Auto-fixes applied ({fixes.length})
            </h4>
            <ul className="space-y-1.5">
              {fixes.map((fix, i) => (
                <li key={`${fix}-${i}`} className="flex gap-2 text-sm text-teal-800 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="leading-snug">{fix}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Field snapshot</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              ['Mobile', row.contact],
              ['Company', row.companyName],
              ['Position', row.position],
              ['CTC', row.ctc],
              ['Expected CTC', row.expectedCtc],
              ['Experience', row.experience],
              ['Notice', row.noticePeriod],
              ['Location', row.location],
              ['Source', row.source],
              ['Client', row.client],
              ['Status', row.status],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2 min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</dt>
                <dd className="text-sm font-medium text-stone-800 truncate mt-0.5">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="border-t border-stone-200 px-4 sm:px-5 py-3.5 bg-stone-50/80 space-y-2 shrink-0">
        <p className="text-[11px] text-stone-500 font-medium">
          {ready ? 'Eligible for Candidates release' : 'Complete the checklist before release'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary !h-10 !text-xs flex-1 sm:flex-none" onClick={() => onFix(row)}>
            <ClipboardPen className="w-4 h-4" /> Fix record
          </button>
          <button
            type="button"
            className="btn-primary !h-10 !text-xs flex-1 sm:flex-none"
            disabled={!ready || isImporting}
            onClick={() => onRelease(row._id)}
            title={ready ? 'Release into Candidates' : 'Fix required fields first'}
          >
            <Upload className="w-4 h-4" /> Approve & release
          </button>
          <button
            type="button"
            className="btn-secondary !h-10 !text-xs !text-red-600 !border-red-200 hover:!bg-red-50"
            onClick={() => onDiscard(row._id)}
          >
            <Ban className="w-4 h-4" /> Discard
          </button>
        </div>
      </div>
    </div>
  );
}
