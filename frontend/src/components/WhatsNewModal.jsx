import React from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Check } from 'lucide-react';
import { PRODUCT_UPDATES } from '../config/productUpdates';

export default function WhatsNewModal({ open, onClose, onAcknowledge }) {
  if (!open) return null;

  const latest = PRODUCT_UPDATES[0];
  if (!latest) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
      >
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-brand-700">
              <Sparkles size={18} />
              <p className="text-[11px] font-bold uppercase tracking-wider">Product update</p>
            </div>
            <h2 id="whats-new-title" className="text-lg font-bold text-stone-900 mt-1">
              {latest.title}
            </h2>
            <p className="text-xs text-stone-500 mt-1">{latest.summary}</p>
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

        <ul className="px-5 sm:px-6 py-4 space-y-2.5 max-h-[50vh] overflow-y-auto">
          {(latest.highlights || []).map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-sm text-stone-700">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center flex-shrink-0">
                <Check size={12} />
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="px-5 sm:px-6 py-4 border-t border-stone-100 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Later
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onAcknowledge?.(latest.id);
              onClose?.();
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
