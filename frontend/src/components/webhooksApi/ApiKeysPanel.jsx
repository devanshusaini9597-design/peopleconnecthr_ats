import React from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import EmptyState from '../ui/EmptyState';

export default function ApiKeysPanel({ apiKeys, onNew, onRevoke }) {
  return (
    <section data-tour="wh-keys" className="card-ats-bordered relative overflow-hidden flex flex-col">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative px-4 sm:px-5 py-3.5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
          <KeyRound className="w-4 h-4 text-brand-600 shrink-0" />
          API keys
          <span className="text-xs font-semibold text-stone-400">{apiKeys.length}</span>
        </h2>
        <button type="button" onClick={onNew} className="btn-primary !text-sm w-full sm:w-auto">
          <Plus className="w-4 h-4" /> New Key
        </button>
      </div>

      {apiKeys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          tone="amber"
          message="No API keys yet"
          subMessage="Create a key to authenticate against the public REST API."
          action={
            <button type="button" onClick={onNew} className="btn-primary">
              <Plus className="w-4 h-4" /> New Key
            </button>
          }
        />
      ) : (
        <div className="relative divide-y divide-stone-100">
          {apiKeys.map((key) => (
            <div key={key._id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-stone-900 text-sm">{key.name}</div>
                  <div className="text-xs text-stone-400 mt-0.5 font-mono">{key.keyPrefix}••••••••</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {key.scopes.map((s) => (
                      <span key={s} className="badge-neutral !text-[10px] capitalize">{s}</span>
                    ))}
                    {key.lastUsedAt && (
                      <span className="text-[10px] text-stone-400">Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => onRevoke(key)} className="p-2 rounded-xl hover:bg-red-50 text-red-500 self-start sm:self-auto" title="Revoke">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
