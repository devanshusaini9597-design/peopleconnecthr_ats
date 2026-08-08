import React from 'react';
import {
  Webhook, Plus, Trash2, RefreshCw, Power, ChevronDown, ChevronUp,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import DeliveryLog from './DeliveryLog';

export default function WebhookEndpointsPanel({
  endpoints,
  expandedEndpoint,
  setExpandedEndpoint,
  onNew,
  onToggle,
  onRotateSecret,
  onDelete,
}) {
  return (
    <section data-tour="wh-endpoints" className="card-ats-bordered relative overflow-hidden flex flex-col">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative px-4 sm:px-5 py-3.5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
          <Webhook className="w-4 h-4 text-brand-600 shrink-0" />
          Webhook endpoints
          <span className="text-xs font-semibold text-stone-400">{endpoints.length}</span>
        </h2>
        <button type="button" onClick={onNew} className="btn-primary !text-sm w-full sm:w-auto">
          <Plus className="w-4 h-4" /> New Endpoint
        </button>
      </div>

      {endpoints.length === 0 ? (
        <EmptyState
          icon={Webhook}
          tone="violet"
          message="No webhook endpoints yet"
          subMessage="Create an endpoint to receive ATS events in your own systems."
          action={
            <button type="button" onClick={onNew} className="btn-primary">
              <Plus className="w-4 h-4" /> New Endpoint
            </button>
          }
        />
      ) : (
        <div className="relative divide-y divide-stone-100">
          {endpoints.map((ep) => (
            <div key={ep._id}>
              <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    ep.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-stone-100 text-stone-400 border border-stone-200'
                  }`}>
                    <Webhook className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-900 truncate text-sm">{ep.url}</div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {ep.events.length} event{ep.events.length !== 1 ? 's' : ''}
                      {ep.description ? ` · ${ep.description}` : ''}
                    </div>
                    {ep.lastDeliveryStatus && (
                      <div className={`text-xs mt-1 font-medium ${ep.lastDeliveryStatus === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                        Last: {ep.lastDeliveryStatus} · {new Date(ep.lastDeliveryAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 pl-12 sm:pl-0">
                  <span className={`mr-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    ep.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-stone-100 text-stone-500 border-stone-200'
                  }`}>
                    {ep.isActive ? 'Active' : 'Off'}
                  </span>
                  <button type="button" onClick={() => setExpandedEndpoint(expandedEndpoint === ep._id ? null : ep._id)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500" title="Deliveries">
                    {expandedEndpoint === ep._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => onToggle(ep)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500" title={ep.isActive ? 'Disable' : 'Enable'}>
                    <Power className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onRotateSecret(ep)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500" title="Rotate secret">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(ep)} className="p-2 rounded-xl hover:bg-red-50 text-red-500" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {expandedEndpoint === ep._id && (
                <div className="border-t border-stone-100 bg-stone-50/60">
                  <DeliveryLog endpointId={ep._id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
