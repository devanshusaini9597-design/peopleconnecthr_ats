import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import { X } from 'lucide-react';
import useModalLayer from '../../hooks/useModalLayer';

/**
 * Codester-style modal shell — stone overlay, scale-in panel, gradient accent.
 * size: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'manage'
 * Focus trapped via react-focus-lock for keyboard / screen-reader a11y.
 */
const SIZE = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl',
  /** Manage picklists — a bit wider than md, still phone-safe */
  manage: 'max-w-[min(100%,40rem)] sm:max-w-2xl',
};

const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  zClass = 'z-[100]',
  icon: Icon,
  bodyClassName,
  fillHeight = false,
  disableFocusLock = false,
}) => {
  const { isTop } = useModalLayer(open);
  const lockOff = disableFocusLock || !isTop;

  useEffect(() => {
    if (!open || !isTop) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, isTop]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-x-hidden overflow-y-auto overscroll-contain animate-fade-in`}
      inert={lockOff ? '' : undefined}
      aria-hidden={lockOff || undefined}
    >
      <div
        className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm"
        onClick={closeOnBackdrop && isTop ? onClose : undefined}
        aria-hidden="true"
      />
      <FocusLock
        returnFocus={!lockOff}
        disabled={lockOff}
        className={`relative w-full min-w-0 ${SIZE[size] || SIZE.md} my-auto max-h-[100dvh] ${size === 'full' || fillHeight ? 'sm:max-h-[min(94vh,980px)]' : 'sm:max-h-[min(92vh,880px)]'} flex flex-col`}
      >
        <div
          className={`relative w-full min-w-0 min-h-0 flex-1 rounded-none sm:rounded-2xl border-0 sm:border border-stone-200/60 bg-white shadow-2xl overflow-hidden flex flex-col modal-panel-ats h-[100dvh] ${size === 'full' || fillHeight ? 'sm:h-[min(94vh,980px)]' : 'sm:h-auto'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-describedby={description ? 'modal-description' : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 flex-shrink-0" aria-hidden="true" />
          {(title || onClose) && (
            <div className="flex items-start justify-between gap-2 sm:gap-3 px-3.5 sm:px-6 py-3 sm:py-3.5 border-b border-stone-100 flex-shrink-0 bg-gradient-to-r from-stone-50/80 via-white to-teal-50/30">
              <div className="min-w-0 flex items-start gap-2.5 sm:gap-3">
                {Icon ? (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-brand-600 to-teal-600 flex items-center justify-center shadow-md shadow-brand-500/25 flex-shrink-0" aria-hidden="true">
                    <Icon size={16} className="text-white sm:hidden" />
                    <Icon size={18} className="text-white hidden sm:block" />
                  </div>
                ) : null}
                <div className="min-w-0">
                  {title && (
                    <h3 id="modal-title" className="text-base sm:text-lg font-bold text-stone-900 tracking-tight break-words" style={{ letterSpacing: '-0.02em' }}>
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p id="modal-description" className="text-stone-500 text-[11px] sm:text-xs mt-0.5 leading-snug break-words">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 sm:p-2.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-all duration-200 hover:rotate-90 flex-shrink-0 touch-target"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <div className={bodyClassName || 'px-3.5 sm:px-5 py-3.5 sm:py-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 overscroll-contain bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_28%)]'}>
            {children}
          </div>
          {footer && (
            <div className="px-3.5 sm:px-5 py-3 border-t border-stone-100 bg-gradient-to-r from-stone-50/95 via-white to-teal-50/20 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3 [&>button]:w-full [&>button]:justify-center sm:[&>button]:w-auto">
              {footer}
            </div>
          )}
        </div>
      </FocusLock>
    </div>,
    document.body
  );
};

export default Modal;
