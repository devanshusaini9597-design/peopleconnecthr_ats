import React, { useEffect, useState } from 'react';
import { Megaphone, X, Info, CheckCircle2, AlertTriangle, Siren } from 'lucide-react';
import API_URL from '../config';

const SEVERITY = {
  info: { icon: Info, bg: 'bg-sky-600', hover: 'hover:bg-sky-700' },
  success: { icon: CheckCircle2, bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-600', hover: 'hover:bg-amber-700' },
  critical: { icon: Siren, bg: 'bg-red-600', hover: 'hover:bg-red-700' }
};

const dismissKey = (orgSlug, id) => `ann_public_dismiss_${orgSlug}_${id}`;

/**
 * Enterprise-style slim top strip for public careers pages.
 * Audience=public announcements only. Dismiss stored in sessionStorage.
 */
export default function PublicAnnouncementBanner({ orgSlug }) {
  const [item, setItem] = useState(null);

  useEffect(() => {
    if (!orgSlug) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/announcements/${encodeURIComponent(orgSlug)}`);
        if (!res.ok) return;
        const data = await res.json();
        const rows = data.success ? (data.data || []) : [];
        const next = rows.find((r) => !sessionStorage.getItem(dismissKey(orgSlug, r._id)));
        if (!cancelled) setItem(next || null);
      } catch {
        if (!cancelled) setItem(null);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug]);

  if (!item) return null;

  const meta = SEVERITY[item.severity] || SEVERITY.info;
  const Icon = meta.icon;

  return (
    <div className={`w-full ${meta.bg} text-white`} role="status">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex items-start sm:items-center gap-3">
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0 opacity-95" />
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-bold tracking-tight">{item.title}</span>
          {item.body ? (
            <span className="opacity-95">
              <span className="mx-1.5 opacity-60 hidden sm:inline">·</span>
              <span className="block sm:inline font-medium sm:font-normal mt-0.5 sm:mt-0 leading-snug">
                {item.body}
              </span>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            try { sessionStorage.setItem(dismissKey(orgSlug, item._id), '1'); } catch { /* ignore */ }
            setItem(null);
          }}
          className={`p-1.5 rounded-lg text-white/90 ${meta.hover} flex-shrink-0 transition-colors`}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        <Megaphone className="w-3.5 h-3.5 opacity-40 hidden md:block flex-shrink-0" aria-hidden />
      </div>
    </div>
  );
}
