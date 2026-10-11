import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Presentation, RefreshCw, UserPlus } from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';
import usePlatformOps from './usePlatformOps';
import { formatCount, MODULE_CATALOG, PLAN_OPTIONS, relativeTime } from './opsConstants';

export default function PlatformOverview() {
  const { summary, rows, hiddenShells, loading, load } = usePlatformOps('live');
  const [health, setHealth] = useState(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.peopleconnecthr.com';
  const demoPath = summary?.demo?.presentationPath || '/demo';

  useEffect(() => {
    let stop = false;
    const ping = async () => {
      try {
        const res = await authenticatedFetch('/api/platform/health');
        const json = await res.json();
        if (!stop && res.ok) setHealth(json.data || null);
      } catch {
        /* keep last reading */
      }
    };
    ping();
    const id = window.setInterval(ping, 30000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400/90">Control plane</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Overview</h1>
          <p className="mt-1 text-sm text-stone-400">
            Production tenants, plans, and module flags — live from the database
            {summary?.generatedAt ? ` · updated ${relativeTime(summary.generatedAt)}` : ''}.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-800">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link to="/pchr-ops/trials" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500">
            <UserPlus className="w-3.5 h-3.5" /> Trials{summary?.pendingTrials ? ` (${summary.pendingTrials})` : ''}
          </Link>
        </div>
      </div>

      <div className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
        health?.ok === false ? 'border-rose-900 bg-rose-950/40' : 'border-stone-800 bg-stone-900/80'
      }`}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">Platform health</p>
          <p className="mt-1 text-sm text-white">
            {health?.ok ? 'API and database responding' : health ? 'Health check failed' : 'Checking…'}
          </p>
        </div>
        <dl className="flex flex-wrap gap-6 text-xs">
          <div>
            <dt className="text-stone-500">DB</dt>
            <dd className="text-white font-medium">{health?.db || '—'}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Latency</dt>
            <dd className="text-white font-medium tabular-nums">{health?.latencyMs != null ? `${health.latencyMs}ms` : '—'}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Suspended</dt>
            <dd className="text-white font-medium tabular-nums">{formatCount(health?.suspended)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Live clients', value: summary?.clients, caption: 'Empty shells hidden' },
          { label: 'Client seats', value: summary?.clientUsers, caption: 'Active non-demo users' },
          { label: 'Pending trials', value: summary?.pendingTrials, caption: 'Waiting on sales' },
          { label: 'Modules in catalog', value: MODULE_CATALOG.length, caption: 'Enable per workspace' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-stone-800 bg-stone-900/80 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{summary || card.label === 'Modules in catalog' ? formatCount(card.value) : '—'}</p>
            <p className="mt-1 text-xs text-stone-500">{card.caption}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <section className="lg:col-span-3 rounded-xl border border-amber-900/60 bg-gradient-to-br from-amber-950/40 to-stone-900 p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center">
              <Presentation className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">Client presentation</p>
              <h2 className="text-lg font-semibold text-white">Sales demo</h2>
              <p className="mt-1 text-sm text-stone-400">Protected tenant. Unfinished modules stay off so the walkthrough matches what buyers get.</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
              {summary?.demo?.workspace ? 'Ready' : 'Not provisioned'}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-stone-500 text-xs">Workspace</dt>
              <dd className="text-white font-medium">{summary?.demo?.workspace?.name || 'peopleconnect-demo'}</dd>
            </div>
            <div>
              <dt className="text-stone-500 text-xs">Demo seats</dt>
              <dd className="text-white font-medium tabular-nums">{summary?.demo?.workspace ? formatCount(summary.demo.workspace.demoUsers) : '—'}</dd>
            </div>
            <div>
              <dt className="text-stone-500 text-xs">Last used</dt>
              <dd className="text-white font-medium">{relativeTime(summary?.demo?.workspace?.lastUsedAt)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`${origin}${demoPath}`} target="_blank" rel="noreferrer" className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-stone-950 hover:bg-amber-400">Open demo</a>
            <Link to="/pchr-ops/demo" className="rounded-lg border border-stone-700 px-3 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-800">Demo controls</Link>
          </div>
        </section>

        <section className="lg:col-span-2 rounded-xl border border-stone-800 bg-stone-900/80 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Live workspaces</h2>
            <Link to="/pchr-ops/workspaces" className="text-xs font-semibold text-teal-400 hover:text-teal-300">Directory</Link>
          </div>
          {loading ? (
            <div className="py-10 flex justify-center text-stone-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <ul className="mt-3 divide-y divide-stone-800">
              {rows.map((row) => (
                <li key={row.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/pchr-ops/workspaces/${row.id}`} className="text-sm font-medium text-white truncate hover:text-teal-300 block">{row.name}</Link>
                    <p className="text-xs text-stone-500 truncate">{row.kind} · {PLAN_OPTIONS.find((p) => p.id === row.plan)?.label} · {formatCount(row.userCount)} seats</p>
                  </div>
                  <p className="text-xs text-stone-500 whitespace-nowrap">{formatCount(row.previewModules?.length || 0)}/{MODULE_CATALOG.length} modules</p>
                </li>
              ))}
            </ul>
          )}
          {hiddenShells > 0 ? (
            <p className="mt-3 text-xs text-stone-500">
              {hiddenShells} empty shell{hiddenShells === 1 ? '' : 's'} hidden.{' '}
              <Link to="/pchr-ops/workspaces?view=archived" className="text-teal-400 font-semibold">Review archived</Link>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
