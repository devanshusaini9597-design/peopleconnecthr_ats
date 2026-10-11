import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, Building2, Loader2, Search } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import usePlatformOps from './usePlatformOps';
import { formatCount, MODULE_CATALOG, PLAN_OPTIONS, relativeTime } from './opsConstants';

const VIEWS = [
  { id: 'live', label: 'Live' },
  { id: 'clients', label: 'Clients' },
  { id: 'demo', label: 'Demo' },
  { id: 'shells', label: 'Empty shells' },
  { id: 'archived', label: 'Archived' },
];

export default function PlatformWorkspaces() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'live';
  const { rows, hiddenShells, loading, savingId, q, setQ, load, patch } = usePlatformOps(view);
  const [archiveRow, setArchiveRow] = useState(null);

  const title = useMemo(() => VIEWS.find((v) => v.id === view)?.label || 'Workspaces', [view]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400/90">Directory</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-stone-400">
          Live directory is Skillnix Recruitment, Devlumiq, and the presentation demo. Empty leftover orgs are archived automatically.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {VIEWS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setParams(tab.id === 'live' ? {} : { view: tab.id })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                view === tab.id
                  ? 'bg-white text-stone-900 border-white'
                  : 'bg-transparent text-stone-300 border-stone-700 hover:bg-stone-800'
              }`}
            >
              {tab.label}
              {tab.id === 'shells' && hiddenShells ? ` (${hiddenShells})` : ''}
            </button>
          ))}
        </div>
        <form className="relative w-full lg:w-80" onSubmit={(e) => { e.preventDefault(); load(view, q); }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search workspace"
            className="w-full rounded-lg bg-stone-900 border border-stone-700 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-teal-500"
          />
        </form>
      </div>

      <div className="rounded-xl border border-stone-800 overflow-hidden bg-stone-950">
        {loading ? (
          <div className="py-20 flex justify-center text-stone-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-500">Nothing in this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-stone-500 bg-stone-900/80">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Workspace</th>
                  <th className="text-left px-4 py-3 font-semibold">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold">Usage</th>
                  <th className="text-left px-4 py-3 font-semibold">Modules</th>
                  <th className="text-left px-4 py-3 font-semibold">Activity</th>
                  <th className="text-right px-4 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {row.logo ? (
                          <img src={row.logo} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-stone-800 text-stone-400 flex items-center justify-center">
                            <Building2 className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <Link to={`/pchr-ops/workspaces/${row.id}`} className="font-medium text-white hover:text-teal-300">
                            {row.name}
                          </Link>
                          <p className="text-xs text-stone-500">
                            {row.domain || row.slug} · {row.kind}
                            {row.isActive === false ? ' · Suspended' : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.plan}
                        disabled={savingId === row.id || row.isCanonicalDemo || row.isVendorProtected}
                        onChange={(e) => patch(row.id, { plan: e.target.value })}
                        className="rounded-lg bg-stone-900 border border-stone-700 px-2 py-1.5 text-xs text-white"
                      >
                        {PLAN_OPTIONS.map((plan) => (
                          <option key={plan.id} value={plan.id}>{plan.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-stone-300 tabular-nums">
                      <p>{formatCount(row.userCount)} seats</p>
                      <p className="text-xs text-stone-500">{formatCount(row.openJobs)} open jobs · {formatCount(row.candidates)} candidates</p>
                    </td>
                    <td className="px-4 py-3 text-stone-300 tabular-nums">
                      {row.kind === 'demo' ? 'Off (demo)' : `${formatCount(row.previewModules?.length || 0)} / ${MODULE_CATALOG.length}`}
                    </td>
                    <td className="px-4 py-3 text-stone-400 whitespace-nowrap">{relativeTime(row.lastActiveAt || row.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {row.isCanonicalDemo || row.isVendorProtected ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400">
                          {row.isCanonicalDemo ? 'Protected demo' : 'Protected vendor'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setArchiveRow(row)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-stone-400 hover:text-white"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          {row.archived ? 'Restore' : 'Archive'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={Boolean(archiveRow)}
        type="warning"
        title={archiveRow?.archived ? 'Restore this workspace?' : 'Archive this workspace?'}
        message="Data is kept. Archived shells leave the live directory so only real clients and the presentation demo remain."
        confirmText={archiveRow?.archived ? 'Restore' : 'Archive'}
        onClose={() => setArchiveRow(null)}
        onConfirm={() => {
          const id = archiveRow?.id;
          const next = !archiveRow?.archived;
          setArchiveRow(null);
          if (id) patch(id, { archived: next });
        }}
      />
    </div>
  );
}
