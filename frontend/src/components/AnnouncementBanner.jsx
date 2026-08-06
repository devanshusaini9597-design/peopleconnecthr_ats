import React, { useCallback, useEffect, useState } from 'react';
import { X, Info, CheckCircle2, AlertTriangle, Siren } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';

const SEVERITY = {
  info: {
    icon: Info,
    wrap: 'bg-sky-50 border-sky-200 text-sky-950',
    iconWrap: 'bg-sky-100 text-sky-700',
    bar: 'bg-sky-500'
  },
  success: {
    icon: CheckCircle2,
    wrap: 'bg-emerald-50 border-emerald-200 text-emerald-950',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500'
  },
  warning: {
    icon: AlertTriangle,
    wrap: 'bg-amber-50 border-amber-200 text-amber-950',
    iconWrap: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500'
  },
  critical: {
    icon: Siren,
    wrap: 'bg-red-50 border-red-200 text-red-950',
    iconWrap: 'bg-red-100 text-red-700',
    bar: 'bg-red-500'
  }
};

/**
 * In-app org announcements — compact enterprise alert strip under the header
 * on every authenticated page. Per-user dismiss.
 */
export default function AnnouncementBanner() {
  const { organization } = useAuth();
  const enabled = planHasFeature(organization?.plan, 'announcements');
  const [items, setItems] = useState([]);
  const [dismissing, setDismissing] = useState(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }
    try {
      const res = await authenticatedFetch('/api/announcements');
      if (!res.ok) return;
      const data = await readApiJson(res);
      if (data.success) setItems(data.data || []);
    } catch {
      /* optional */
    }
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener('announcements:refresh', onRefresh);
    return () => window.removeEventListener('announcements:refresh', onRefresh);
  }, [load]);

  const dismiss = async (id) => {
    setDismissing(id);
    try {
      await authenticatedFetch(`/api/announcements/${id}/dismiss`, { method: 'POST' });
      setItems((prev) => prev.filter((a) => a._id !== id));
    } catch {
      /* ignore */
    } finally {
      setDismissing(null);
    }
  };

  if (!enabled || items.length === 0) return null;

  return (
    <div className="border-b border-stone-200/80 bg-stone-50/80 px-3 sm:px-4 lg:px-6 py-2 space-y-2 flex-shrink-0">
      {items.slice(0, 2).map((a) => {
        const meta = SEVERITY[a.severity] || SEVERITY.info;
        const Icon = meta.icon;
        return (
          <div
            key={a._id}
            className={`relative flex items-start gap-3 rounded-lg border ${meta.wrap} px-3 py-2.5 shadow-sm overflow-hidden`}
            role="status"
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar}`} />
            <div className={`ml-1 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.iconWrap}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-bold tracking-tight leading-snug">{a.title}</p>
              {a.body ? (
                <p className="text-xs sm:text-sm mt-0.5 leading-relaxed opacity-90 whitespace-pre-wrap break-words">
                  {a.body}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(a._id)}
              disabled={dismissing === a._id}
              className="p-1.5 rounded-md text-stone-500 hover:text-stone-800 hover:bg-white/80 flex-shrink-0 transition-colors disabled:opacity-50"
              aria-label="Dismiss announcement"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
