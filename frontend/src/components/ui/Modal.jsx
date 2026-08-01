import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Codester-style modal shell — stone overlay, scale-in panel, gradient accent.
 * size: 'sm' | 'md' | 'lg' | 'xl' | 'full'
 */
const SIZE = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
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
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in">
      <div
        className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      <div
        className={`relative w-full my-auto ${SIZE[size] || SIZE.md} rounded-t-2xl sm:rounded-3xl border border-stone-200/60 bg-white shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[90vh] flex flex-col modal-panel-ats`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 flex-shrink-0" />
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-stone-100 flex-shrink-0">
            <div className="min-w-0">
              {title && (
                <h3 id="modal-title" className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                  {title}
                </h3>
              )}
              {description && <p className="text-stone-500 text-sm mt-1.5 leading-relaxed">{description}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-all duration-200 hover:rotate-90 flex-shrink-0 touch-target"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-stone-100 bg-stone-50/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
