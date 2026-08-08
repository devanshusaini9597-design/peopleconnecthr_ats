import React from 'react';
import {
  Search, Loader2, Inbox, Save, FileSpreadsheet, CheckSquare, Square,
  Sparkles, Edit2, ChevronLeft, ChevronRight, Info,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { PAGE_SIZE, rowKey } from './constants';
import CategoryBadge from './CategoryBadge';

export default function ReviewStep({
  readyCount,
  reviewCount,
  blockedCount,
  stats,
  dbDupCount,
  selected,
  selectedNew,
  selectedUpdates,
  bucket,
  setBucket,
  query,
  setQuery,
  setPage,
  selectAllReady,
  selectPageReady,
  skipExistingInAts,
  clearSelection,
  isSavingPending,
  sendRestToPending,
  isImporting,
  confirmImport,
  tableScrollRef,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
  pageRows,
  toggleRow,
  setEditingRow,
  setEditErrors,
  filtered,
  page,
  totalPages,
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Ready', value: readyCount, tone: 'text-emerald-700', sub: 'Valid to import' },
          { label: 'Needs review', value: reviewCount, tone: 'text-amber-700', sub: 'Fix or pending' },
          { label: 'Blocked', value: blockedCount, tone: 'text-red-700', sub: 'Critical issues' },
          { label: 'Already in ATS', value: stats?.dbDuplicates ?? dbDupCount, tone: 'text-violet-700', sub: 'Will update on import' },
          { label: 'Selected', value: selected.size, tone: 'text-brand-700', sub: `${selectedNew} new · ${selectedUpdates} update` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className={`text-2xl font-bold tabular-nums leading-none ${k.tone}`}>{k.value}</p>
            <p className="text-sm font-semibold text-stone-800 mt-1.5">{k.label}</p>
            <p className="text-[11px] text-stone-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'ready', label: 'Ready', n: readyCount },
            { id: 'review', label: 'Needs review', n: reviewCount },
            { id: 'blocked', label: 'Blocked', n: blockedCount },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setBucket(t.id); setQuery(''); setPage(1); }}
              className={`h-9 px-3 rounded-xl text-xs font-bold border ${
                bucket === t.id && !query ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-stone-200 text-stone-600'
              }`}
            >
              {t.label} · {t.n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              className="input-ats !h-9 !pl-9 !py-0 !text-xs w-44"
              placeholder="Search…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={selectAllReady}>Select all Ready</button>
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={selectPageReady}>Select page Ready</button>
          {dbDupCount > 0 && (
            <button type="button" className="btn-secondary !h-9 !text-xs" onClick={skipExistingInAts}>
              Skip already in ATS
            </button>
          )}
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={clearSelection}>Clear</button>
          {(reviewCount + blockedCount) > 0 && (
            <button type="button" className="btn-secondary !h-9 !text-xs" disabled={isSavingPending} onClick={sendRestToPending}>
              {isSavingPending ? <Loader2 size={14} className="animate-spin" /> : <Inbox size={14} />}
              Pending Review
            </button>
          )}
          <button type="button" className="btn-primary !h-9 !text-xs" disabled={isImporting || selected.size === 0} onClick={confirmImport}>
            {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Import selected ({selected.size})
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
        <div
          ref={tableScrollRef}
          className="cand-table-scroll overflow-x-auto select-none"
          onMouseDown={onTableDragScrollStart}
          onMouseMove={onTableDragScrollMove}
          onMouseUp={onTableDragScrollEnd}
          onMouseLeave={onTableDragScrollEnd}
        >
          {pageRows.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} tone="sky" compact message="No rows in this view" subMessage="Switch bucket or clear search." />
          ) : (
            <table className="cand-table-drag w-full text-left border-collapse min-w-[1280px] select-text border border-stone-200">
              <thead>
                <tr className="bg-stone-100">
                  <th className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100" />
                  {['Status', 'Name', 'Email', 'Contact', 'Company', 'Score', 'Fixes', 'Edit'].map((h) => (
                    <th
                      key={h}
                      className="px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, index) => {
                  const f = row.fixed || {};
                  const k = rowKey(row);
                  const on = selected.has(k);
                  const fixes = (row.autoFixChanges || []).length;
                  return (
                    <tr
                      key={k}
                      className={`transition-colors ${
                        on ? 'bg-brand-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'
                      } hover:bg-brand-50/50`}
                    >
                      <td className="px-3.5 py-3 text-center w-[52px] border border-stone-200">
                        <button
                          type="button"
                          onClick={() => toggleRow(row)}
                          className={`inline-flex justify-center w-full ${row._category === 'ready' ? 'text-brand-700' : 'text-stone-300 cursor-not-allowed'}`}
                          aria-label={row._category === 'ready' ? 'Select row' : 'Fix with Edit first'}
                          title={row._category === 'ready' ? 'Select for import' : 'Edit to move to Ready'}
                        >
                          {on ? <CheckSquare size={17} className="text-brand-600" /> : <Square size={17} className="text-stone-300" />}
                        </button>
                      </td>
                      <td className="px-3.5 py-3 border border-stone-200 align-middle whitespace-nowrap">
                        <CategoryBadge cat={row._category} isDbDuplicate={row.isDbDuplicate} />
                      </td>
                      <td className="px-3.5 py-3 text-sm font-semibold text-stone-900 border border-stone-200 align-middle whitespace-nowrap">{f.name || '—'}</td>
                      <td className="px-3.5 py-3 text-sm text-stone-600 border border-stone-200 align-middle whitespace-nowrap">{f.email || '—'}</td>
                      <td className="px-3.5 py-3 text-sm font-mono text-stone-600 border border-stone-200 align-middle whitespace-nowrap">{f.contact || '—'}</td>
                      <td className="px-3.5 py-3 text-sm text-stone-700 border border-stone-200 align-middle whitespace-nowrap">{f.companyName || '—'}</td>
                      <td className="px-3.5 py-3 text-sm font-bold text-stone-800 tabular-nums border border-stone-200 align-middle whitespace-nowrap">{row.validation?.confidence ?? 0}%</td>
                      <td className="px-3.5 py-3 border border-stone-200 align-middle whitespace-nowrap">
                        {fixes > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                            <Sparkles size={10} /> {fixes}
                          </span>
                        ) : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3.5 py-3 border border-stone-200 align-middle whitespace-nowrap">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-full border border-stone-200 bg-stone-50 inline-flex items-center justify-center text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50"
                          onClick={() => { setEditingRow(row); setEditErrors({}); }}
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3.5 flex items-center justify-between text-xs text-stone-500">
            <span className="tabular-nums font-medium">{filtered.length} rows</span>
            <div className="flex gap-1">
              <button type="button" className="btn-secondary !h-8 !w-8 !p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={14} /></button>
              <span className="px-2 font-semibold text-stone-700 self-center">{page}/{totalPages}</span>
              <button type="button" className="btn-secondary !h-8 !w-8 !p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-[13px] text-stone-700 flex gap-3 items-start">
        <Info size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-semibold text-stone-900">Before you import</p>
          <p>
            Review Ready rows, then import only what you select. Matching emails update the existing candidate — no duplicate profiles.
            Unchecked or incomplete rows stay out of Candidates until you fix them or send them to Pending Review.
          </p>
        </div>
      </div>
    </div>
  );
}
