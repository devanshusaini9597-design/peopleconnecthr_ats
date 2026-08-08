import React, { useState, useEffect } from 'react';
import { Webhook, Loader2 } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { authenticatedFetch } from '../../utils/fetchUtils';

export default function DeliveryLog({ endpointId }) {
  const [deliveries, setDeliveries] = useState(null);
  useEffect(() => {
    authenticatedFetch(`/api/webhooks/${endpointId}/deliveries`).then((r) => r.json()).then((d) => setDeliveries(d.data || []));
  }, [endpointId]);
  if (deliveries === null) {
    return (
      <div className="p-4 text-sm text-stone-400 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" /> Loading deliveries…
      </div>
    );
  }
  if (deliveries.length === 0) {
    return (
      <EmptyState
        icon={Webhook}
        tone="sky"
        compact
        message="No deliveries yet"
        subMessage="Events will appear here once this webhook fires."
      />
    );
  }
  return (
    <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto overscroll-contain">
      {deliveries.map((d) => (
        <div key={d._id} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${d.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-mono text-stone-700 truncate">{d.eventType}</span>
          </div>
          <div className="text-stone-400 truncate pl-4 sm:pl-0">
            {d.responseStatus || d.errorMessage || '—'} · {new Date(d.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
