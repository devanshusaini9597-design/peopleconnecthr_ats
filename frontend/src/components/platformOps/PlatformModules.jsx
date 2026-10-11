import React from 'react';
import { Loader2 } from 'lucide-react';
import usePlatformOps from './usePlatformOps';
import { MODULE_CATALOG, PRODUCT_GROUPS } from './opsConstants';
import { planHasFeature } from '../../config/planFeatures';

function CellSwitch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`mx-auto relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-teal-500' : 'bg-stone-700'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4.5 ml-4' : 'ml-0.5'}`} />
    </button>
  );
}

export default function PlatformModules() {
  const { rows, loading, savingId, patch } = usePlatformOps('live');
  const tenants = rows.filter((row) => row.kind !== 'platform');

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400/90">Entitlements</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Modules</h1>
        <p className="mt-1 text-sm text-stone-400 max-w-3xl">
          Unfinished surfaces are flags you turn on per tenant. The rest of the catalog follows the workspace plan (SSO, AI, MIS-related analytics, integrations).
        </p>
      </div>

      <div className="rounded-xl border border-stone-800 overflow-hidden bg-stone-950">
        {loading ? (
          <div className="py-20 flex justify-center text-stone-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-stone-900/80">
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-stone-500 font-semibold sticky left-0 bg-stone-900/80">Workspace</th>
                  {MODULE_CATALOG.map((mod) => (
                    <th key={mod.key} className="px-2 py-3 text-center min-w-[7.5rem]">
                      <p className="text-[11px] font-semibold text-stone-200">{mod.name}</p>
                      <p className="text-[10px] font-normal text-stone-500 leading-tight mt-0.5">{mod.blurb}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {tenants.map((row) => {
                  const locked = row.kind === 'demo' || row.isCanonicalDemo;
                  const enabled = new Set(row.previewModules || []);
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3 sticky left-0 bg-stone-950">
                        <p className="font-medium text-white">{row.name}</p>
                        <p className="text-[11px] text-stone-500">{row.kind}{locked ? ' · locked' : ''}</p>
                      </td>
                      {MODULE_CATALOG.map((mod) => (
                        <td key={mod.key} className="px-2 py-3 text-center">
                          <CellSwitch
                            checked={!locked && enabled.has(mod.key)}
                            disabled={locked || savingId === row.id}
                            label={`${mod.name} for ${row.name}`}
                            onChange={(next) => patch(row.id, { previewModule: mod.key, enabled: next })}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-stone-800 overflow-hidden bg-stone-950">
        <div className="px-4 py-3 border-b border-stone-800">
          <h2 className="text-sm font-semibold text-white">Plan catalog</h2>
          <p className="text-xs text-stone-500 mt-0.5">Included with the workspace plan. Unfinished flags above are separate.</p>
        </div>
        {loading ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-900/80">
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-stone-500">Workspace</th>
                  {PRODUCT_GROUPS.map((group) => (
                    <th key={group.id} className="px-3 py-3 text-center text-[11px] text-stone-300 font-semibold">{group.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {tenants.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-white font-medium">{row.name}</td>
                    {PRODUCT_GROUPS.map((group) => {
                      const on = group.keys.filter((key) => planHasFeature(row.plan, key)).length;
                      return (
                        <td key={group.id} className="px-3 py-3 text-center tabular-nums text-stone-300">
                          {on}/{group.keys.length}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
