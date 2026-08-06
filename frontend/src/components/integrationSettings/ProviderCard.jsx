import React from 'react';
import { Settings, Lock } from 'lucide-react';
import { planHasFeature } from '../../config/planFeatures';

export default function ProviderCard({ provider, config, organization, onConfigure }) {
  const Icon = provider.icon;
  const connected = !!(config && config.isActive !== false && config.hasCredentials);
  const validated = !!config?.isValidated;
  const entitled = !provider.feature || planHasFeature(organization?.plan, provider.feature);

  return (
    <article
      className="card-ats-bordered overflow-hidden flex flex-col relative group h-full"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-70" />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${provider.bg || 'bg-stone-100'} ${provider.color || 'text-stone-500'} ring-1 ring-black/5`}>
            <Icon className="w-5 h-5" />
          </div>
          {!entitled ? (
            <span className="badge-warning inline-flex items-center gap-1">
              <Lock className="w-3 h-3" /> Upgrade
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
              connected
                ? (validated
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200')
                : 'bg-stone-100 text-stone-500 border-stone-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? (validated ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-stone-400'}`} />
              {connected ? (validated ? 'Connected' : 'Unverified') : 'Not set up'}
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-stone-900 tracking-tight">{provider.name}</h3>
        <p className="text-sm text-stone-500 mt-1.5 leading-relaxed flex-1">{provider.desc}</p>
        <button
          type="button"
          onClick={() => entitled && onConfigure(provider)}
          disabled={!entitled}
          className="mt-4 w-full btn-secondary !justify-center disabled:opacity-50"
        >
          {entitled ? (
            <><Settings className="w-4 h-4" /> {connected ? 'Manage' : 'Configure'}</>
          ) : (
            <><Lock className="w-4 h-4" /> Upgrade to unlock</>
          )}
        </button>
      </div>
    </article>
  );
}
