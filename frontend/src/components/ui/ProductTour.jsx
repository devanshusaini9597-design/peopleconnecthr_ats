import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

/**
 * Lightweight product tour — spotlight + step card (enterprise onboarding).
 * steps: [{ target?: CSS selector, title, body, placement?: 'auto'|'top'|'bottom' }]
 * storageKey: if set, "Don't show again" / completed is persisted
 */
export default function ProductTour({
  open,
  onClose,
  steps = [],
  storageKey,
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const step = steps[index] || null;
  const total = steps.length;
  const isLast = index >= total - 1;

  const finish = useCallback(() => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    }
    onClose?.();
  }, [storageKey, onClose]);

  const measure = useCallback(() => {
    if (!open || !step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 8;
    setRect({
      top: Math.max(8, r.top - pad),
      left: Math.max(8, r.left - pad),
      width: Math.min(window.innerWidth - 16, r.width + pad * 2),
      height: Math.min(window.innerHeight - 16, r.height + pad * 2),
    });
    try {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch { /* ignore */ }
  }, [open, step]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, index, measure]);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (isLast) finish();
        else setIndex((i) => Math.min(total - 1, i + 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, isLast, total, finish]);

  if (!open || !step || typeof document === 'undefined') return null;

  const cardW = 340;
  let cardTop = 96;
  let cardLeft = Math.max(16, (window.innerWidth - cardW) / 2);

  if (rect) {
    const preferBottom = step.placement === 'bottom'
      || (step.placement !== 'top' && rect.top + rect.height + 220 < window.innerHeight);
    if (preferBottom) {
      cardTop = Math.min(window.innerHeight - 220, rect.top + rect.height + 14);
    } else {
      cardTop = Math.max(16, rect.top - 200);
    }
    cardLeft = Math.min(
      window.innerWidth - cardW - 16,
      Math.max(16, rect.left + rect.width / 2 - cardW / 2)
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="product-tour-title">
      {/* Dim layer with spotlight cutout */}
      <div className="absolute inset-0 pointer-events-auto" onClick={finish} aria-hidden>
        {rect ? (
          <div
            className="absolute rounded-2xl ring-2 ring-white/90 shadow-[0_0_0_9999px_rgba(28,25,23,0.55)] transition-all duration-300 ease-out"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-[1px]" />
        )}
      </div>

      {/* Step card */}
      <div
        className="absolute z-[201] w-[min(100%-2rem,340px)] rounded-2xl border border-stone-200/70 bg-white shadow-2xl overflow-hidden modal-panel-ats transition-all duration-300"
        style={{ top: cardTop, left: cardLeft }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-brand-600" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  Step {index + 1} of {total}
                </p>
                <h3 id="product-tour-title" className="text-base font-bold text-stone-900 tracking-tight mt-0.5">
                  {step.title}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={finish}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 flex-shrink-0"
              aria-label="Close tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-stone-500 mt-3 leading-relaxed">{step.body}</p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" aria-hidden>
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-5 bg-brand-600' : 'w-1.5 bg-stone-200'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-2"
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button
                type="button"
                className="btn-primary !px-3 !py-2"
                onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              >
                {isLast ? 'Got it' : 'Next'}
                {!isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {storageKey && (
            <button
              type="button"
              onClick={finish}
              className="mt-3 w-full text-center text-[11px] font-medium text-stone-400 hover:text-stone-600"
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Returns true if this tour has not been completed yet */
export function shouldAutoStartTour(storageKey) {
  if (!storageKey || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(storageKey) !== '1';
  } catch {
    return false;
  }
}
