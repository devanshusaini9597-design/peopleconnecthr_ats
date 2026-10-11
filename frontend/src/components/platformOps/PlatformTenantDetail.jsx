import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import ConfirmationModal from '../ConfirmationModal';
import { MODULE_CATALOG, PLAN_OPTIONS, PRODUCT_GROUPS, formatCount, relativeTime } from './opsConstants';
import { planHasFeature } from '../../config/planFeatures';

export default function PlatformTenantDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/platform/tenants/${id}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not load workspace');
      setData(json.data);
    } catch (err) {
      toast.error(err.message || 'Could not load workspace');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const res = await authenticatedFetch(`/api/platform/tenants/${id}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.data) setData(json.data);
      } catch {
        /* keep last snapshot */
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, [id]);

  const patch = async (body) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/api/platform/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not update');
      toast.success('Saved');
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not update');
    } finally {
      setSaving(false);
    }
  };

  const inspect = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/api/platform/tenants/${id}/inspect`, { method: 'POST' });
      if (isUnauthorized(res)) return handleUnauthorized();
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not open workspace');
      window.location.href = json.data?.redirect || '/dashboard';
    } catch (err) {
      toast.error(err.message || 'Could not open workspace');
      setSaving(false);
    }
  };

  if (loading || !data?.workspace) {
    return <div className="py-20 flex justify-center text-stone-500"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  const row = data.workspace;
  const locked = row.kind === 'demo' || row.isCanonicalDemo;
  const enabled = new Set(row.previewModules || []);
  const invoices = data.billing?.invoices || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/pchr-ops/workspaces" className="inline-flex items-center gap-1 text-xs font-semibold text-stone-400 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" /> Workspaces
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">{row.name}</h1>
          <p className="text-sm text-stone-400">
            {row.domain || row.slug} · {row.kind} · {PLAN_OPTIONS.find((p) => p.id === row.plan)?.label}
            {row.isActive === false ? ' · Suspended' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={row.plan}
            disabled={saving || row.isCanonicalDemo || row.isVendorProtected}
            onChange={(e) => patch({ plan: e.target.value })}
            className="rounded-lg bg-stone-900 border border-stone-700 px-3 py-2 text-xs text-white"
          >
            {PLAN_OPTIONS.map((plan) => <option key={plan.id} value={plan.id}>{plan.label}</option>)}
          </select>
          {!row.isCanonicalDemo && !row.isVendorProtected ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => (row.isActive === false ? patch({ isActive: true }) : setSuspendOpen(true))}
              className={`rounded-lg px-3 py-2 text-xs font-semibold border ${
                row.isActive === false
                  ? 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500'
                  : 'border-rose-800 text-rose-300 hover:bg-rose-950'
              }`}
            >
              {row.isActive === false ? 'Activate workspace' : 'Suspend workspace'}
            </button>
          ) : null}
          {!locked ? (
            <button type="button" disabled={saving} onClick={() => setInspectOpen(true)} className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500">
              Open product as owner
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Seats', formatCount(row.userCount)],
          ['Open jobs', formatCount(row.openJobs)],
          ['Candidates', formatCount(row.candidates)],
          ['Last activity', relativeTime(row.lastActiveAt || row.createdAt)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-stone-800 bg-stone-900/80 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">{label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-stone-800 bg-stone-900/80 p-5">
        <h2 className="text-sm font-semibold text-white">Commercial</h2>
        <p className="text-xs text-stone-500 mt-1">Plan expiry is stored on the tenant. Leave blank for no hard end date.</p>
        <label className="mt-4 block max-w-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Plan expires</span>
          <input
            type="date"
            disabled={saving || row.isCanonicalDemo}
            value={row.planExpiresAt ? String(row.planExpiresAt).slice(0, 10) : ''}
            onChange={(e) => patch({ planExpiresAt: e.target.value || null })}
            className="mt-1 w-full rounded-lg bg-stone-950 border border-stone-700 px-3 py-2 text-sm text-white"
          />
        </label>
      </section>

      <section className="rounded-xl border border-stone-800 bg-stone-900/80 p-5">
        <h2 className="text-sm font-semibold text-white">Unfinished modules</h2>
        <p className="text-xs text-stone-500 mt-1">These stay off for clients until you enable them here. Demo is locked.</p>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {MODULE_CATALOG.map((mod) => (
            <label key={mod.key} className="flex items-center justify-between gap-3 rounded-lg border border-stone-800 px-3 py-2">
              <span>
                <span className="block text-sm text-white">{mod.name}</span>
                <span className="block text-[11px] text-stone-500">{mod.blurb}</span>
              </span>
              <input
                type="checkbox"
                disabled={locked || saving}
                checked={!locked && enabled.has(mod.key)}
                onChange={(e) => patch({ previewModule: mod.key, enabled: e.target.checked })}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-stone-800 bg-stone-900/80 p-5">
        <h2 className="text-sm font-semibold text-white">Plan catalog</h2>
        <p className="text-xs text-stone-500 mt-1">Included by the current plan. Change the plan to move this tenant across SKUs.</p>
        <div className="mt-4 space-y-4">
          {PRODUCT_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-2">{group.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.keys.map((key) => {
                  const on = planHasFeature(row.plan, key);
                  return (
                    <span key={key} className={`text-[11px] px-2 py-1 rounded-md border ${on ? 'border-teal-800 bg-teal-950/60 text-teal-200' : 'border-stone-800 text-stone-500'}`}>
                      {key} {on ? '· on' : '· off'}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-stone-800 bg-stone-900/80 p-5">
          <h2 className="text-sm font-semibold text-white">People</h2>
          <ul className="mt-3 divide-y divide-stone-800">
            {(data.users || []).map((u) => (
              <li key={u.id} className="py-2 flex justify-between gap-3 text-sm">
                <div>
                  <p className="text-white">{u.name || u.email}</p>
                  <p className="text-xs text-stone-500">{u.email} · {u.role}</p>
                </div>
                <p className="text-xs text-stone-500 whitespace-nowrap">{relativeTime(u.lastLoginAt || u.lastActiveAt)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-stone-800 bg-stone-900/80 p-5">
          <h2 className="text-sm font-semibold text-white">Billing</h2>
          <p className="text-xs text-stone-500 mt-1">
            {data.billing?.customerId ? `Stripe ${data.billing.customerId}` : 'No Stripe customer on this workspace'}
          </p>
          <ul className="mt-3 divide-y divide-stone-800">
            {invoices.length === 0 ? (
              <li className="py-6 text-sm text-stone-500">No invoices on file.</li>
            ) : invoices.map((inv) => (
              <li key={inv.id} className="py-2 flex justify-between text-sm">
                <span className="text-white">{inv.number || inv.id}</span>
                <span className="text-stone-400">{inv.status} · {relativeTime(inv.created)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-stone-800 bg-stone-900/80 p-5">
        <h2 className="text-sm font-semibold text-white">Audit</h2>
        <ul className="mt-3 divide-y divide-stone-800">
          {(data.audit || []).length === 0 ? (
            <li className="py-6 text-sm text-stone-500">No audit events in the last 90 days.</li>
          ) : data.audit.map((a) => (
            <li key={a.id} className="py-2 text-sm flex justify-between gap-3">
              <span className="text-white">{a.action} · {a.resource}</span>
              <span className="text-stone-500 whitespace-nowrap">{relativeTime(a.timestamp)}</span>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmationModal
        isOpen={inspectOpen}
        type="warning"
        title="Open this product workspace as the owner?"
        message="Your operator session will be replaced by that tenant’s owner. Sign in again at /pchr-ops when you are done."
        confirmText="Open as owner"
        onClose={() => setInspectOpen(false)}
        onConfirm={() => { setInspectOpen(false); inspect(); }}
      />
      <ConfirmationModal
        isOpen={suspendOpen}
        type="danger"
        title="Suspend this workspace?"
        message="The tenant stays in the directory but is marked inactive. Protected demo and vendor workspaces cannot be suspended."
        confirmText="Suspend"
        onClose={() => setSuspendOpen(false)}
        onConfirm={() => { setSuspendOpen(false); patch({ isActive: false }); }}
      />
    </div>
  );
}
