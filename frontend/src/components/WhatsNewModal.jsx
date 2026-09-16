import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Compass, Map } from 'lucide-react';
import {
  PRODUCT_UPDATES,
  getLatestProductUpdate,
} from '../config/productUpdates';
import { requestProductTour } from '../utils/productTourTrigger';

/**
 * What's New modal for company staff (not freelancers).
 */
const WhatsNewModal = ({ open, onClose, onAcknowledge }) => {
  const navigate = useNavigate();
  const latest = getLatestProductUpdate();

  useEffect(() => {
    if (!open || !latest?.id) return;
    onAcknowledge?.(latest.id);
  }, [open, latest?.id, onAcknowledge]);

  if (!open || !latest) return null;

  const goExplore = (item) => {
    onClose?.();
    if (item.tourKey) {
      requestProductTour(item.tourKey);
    }
    const rawPath = String(item.path || '/dashboard');
    const hashName = item.hash ? String(item.hash).replace(/^#/, '') : '';
    let pathname = rawPath;
    let search = '';
    try {
      const u = new URL(rawPath, window.location.origin);
      pathname = u.pathname;
      search = u.search;
    } catch {
      const q = rawPath.indexOf('?');
      if (q >= 0) {
        pathname = rawPath.slice(0, q);
        search = rawPath.slice(q);
      }
    }
    navigate({
      pathname,
      search: search || undefined,
      hash: hashName ? `#${hashName}` : undefined,
    });
    if (hashName) {
      window.setTimeout(() => {
        try {
          document.getElementById(hashName)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        } catch {
          /* ignore */
        }
      }, 450);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="relative w-full max-w-lg max-h-[min(90vh,640px)] overflow-hidden rounded-2xl bg-white shadow-2xl border border-stone-200 flex flex-col"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-stone-100 bg-gradient-to-br from-brand-50/80 to-white">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Product update</p>
            <h2 id="whats-new-title" className="text-lg font-bold text-stone-900 leading-snug">
              {latest.title}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">{latest.dateLabel || latest.date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {latest.summary ? (
            <p className="text-sm text-stone-600 leading-relaxed">{latest.summary}</p>
          ) : null}

          <ul className="space-y-3">
            {(latest.highlights || []).map((h) => {
              const title = typeof h === 'string' ? null : h.title;
              const body = typeof h === 'string' ? h : h.body;
              return (
                <li
                  key={title || body}
                  className="rounded-xl border border-stone-100 bg-stone-50/80 px-3.5 py-3"
                >
                  {title ? <p className="text-sm font-semibold text-stone-900">{title}</p> : null}
                  <p className={`text-sm text-stone-600 leading-relaxed ${title ? 'mt-1' : ''}`}>{body}</p>
                </li>
              );
            })}
          </ul>

          {Array.isArray(latest.explore) && latest.explore.length > 0 ? (
            <div className="pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
                <Compass size={12} className="text-brand-600" />
                Explore
              </p>
              <div className="flex flex-col gap-2">
                {latest.explore.map((item) => {
                  const isTour = Boolean(item.tourKey);
                  return (
                    <button
                      key={`${item.path}-${item.label}`}
                      type="button"
                      onClick={() => goExplore(item)}
                      className="inline-flex items-center gap-2 text-left text-sm font-medium text-brand-700 hover:text-brand-900 hover:bg-brand-50 rounded-lg px-3 py-2.5 border border-brand-100 transition-colors"
                    >
                      {isTour ? (
                        <Map size={16} className="flex-shrink-0" />
                      ) : (
                        <Compass size={16} className="flex-shrink-0" />
                      )}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {PRODUCT_UPDATES.length > 1 ? (
            <p className="text-xs text-stone-400 pt-1">
              Showing the latest of {PRODUCT_UPDATES.length} recent updates.
            </p>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;
