import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import { AlertTriangle, Trash2, Share2, Edit2, CheckCircle, X, Loader2, Info, ShieldAlert } from 'lucide-react';

const iconMap = {
  delete: { icon: Trash2, gradient: 'from-red-500 to-red-700', shadow: 'shadow-red-500/25' },
  warning: { icon: AlertTriangle, gradient: 'from-amber-500 to-amber-700', shadow: 'shadow-amber-500/25' },
  share: { icon: Share2, gradient: 'from-emerald-500 to-teal-700', shadow: 'shadow-emerald-500/25' },
  edit: { icon: Edit2, gradient: 'from-brand-500 to-teal-700', shadow: 'shadow-brand-500/25' },
  success: { icon: CheckCircle, gradient: 'from-brand-500 to-teal-700', shadow: 'shadow-brand-500/25' },
  info: { icon: Info, gradient: 'from-sky-500 to-sky-700', shadow: 'shadow-sky-500/25' },
  danger: { icon: ShieldAlert, gradient: 'from-red-500 to-red-700', shadow: 'shadow-red-500/25' },
};

const buttonStyles = {
  delete: 'btn-danger',
  warning: 'btn-primary !bg-amber-600 hover:!bg-amber-700 !shadow-amber-500/25',
  share: 'btn-primary',
  edit: 'btn-primary',
  success: 'btn-primary',
  info: 'btn-primary',
  danger: 'btn-danger',
  default: 'btn-primary',
};

const toneStyles = {
  emerald: { value: 'text-emerald-700', chip: 'bg-emerald-50 border-emerald-100', bar: 'from-emerald-400 to-emerald-600' },
  violet: { value: 'text-violet-700', chip: 'bg-violet-50 border-violet-100', bar: 'from-violet-400 to-violet-600' },
  red: { value: 'text-red-700', chip: 'bg-red-50 border-red-100', bar: 'from-red-400 to-red-600' },
  amber: { value: 'text-amber-700', chip: 'bg-amber-50 border-amber-100', bar: 'from-amber-400 to-amber-600' },
  brand: { value: 'text-brand-700', chip: 'bg-brand-50 border-brand-100', bar: 'from-brand-400 to-teal-600' },
  default: { value: 'text-stone-900', chip: 'bg-stone-50 border-stone-200', bar: 'from-stone-300 to-stone-500' },
};

/**
 * Enterprise confirmation dialog.
 * Optional `stats`: [{ label, value, hint?, tone? }]
 * Optional `eyebrow`: small uppercase label above title
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm action',
  eyebrow = null,
  message = '',
  details = null,
  stats = null,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false,
  showCancel = true,
  zClass = 'z-[200]',
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !isLoading) onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const iconConfig = iconMap[type] || iconMap.warning;
  const IconComponent = iconConfig.icon;
  const btnStyle = buttonStyles[type] || buttonStyles.default;
  const hasStats = Array.isArray(stats) && stats.length > 0;

  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center p-4 sm:p-6 animate-fade-in`}
      onClick={!isLoading ? onClose : undefined}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm" aria-hidden />
      <FocusLock returnFocus>
      <div
        className="relative bg-white rounded-2xl shadow-2xl shadow-stone-900/25 w-full max-w-xl border border-stone-200/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-brand-50/50 via-white to-white border-b border-stone-100">
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${iconConfig.gradient} text-white flex items-center justify-center flex-shrink-0 shadow-lg ${iconConfig.shadow} ring-1 ring-white/20`}>
              <IconComponent size={22} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              {(eyebrow || type === 'success') && (
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700 mb-1">
                  {eyebrow || 'Bulk import'}
                </p>
              )}
              <h3 id="confirm-modal-title" className="text-xl font-bold text-stone-900 tracking-tight">
                {title}
              </h3>
              {message && (
                <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">{message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-stone-200/80 bg-white text-stone-400 hover:text-stone-700 hover:bg-stone-50 shadow-sm transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stats */}
        {hasStats && (
          <div className="px-6 pt-5">
            <div className={`grid gap-3 ${stats.length >= 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {stats.map((s) => {
                const t = toneStyles[s.tone] || toneStyles.default;
                return (
                  <div
                    key={s.label}
                    className={`relative overflow-hidden rounded-xl border ${t.chip} px-3.5 py-3.5 shadow-sm`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${t.bar}`} />
                    <p className={`text-2xl font-bold tabular-nums leading-none tracking-tight ${t.value}`}>{s.value}</p>
                    <p className="text-[11px] font-bold text-stone-700 mt-2.5 tracking-wide">{s.label}</p>
                    {s.hint && <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">{s.hint}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Details */}
        {details && (
          <div className="px-6 pt-4">
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3.5 text-sm text-stone-600 leading-relaxed">
              {typeof details === 'string' ? <p>{details}</p> : details}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 px-6 py-5 mt-2 bg-gradient-to-t from-stone-50 to-white border-t border-stone-100">
          {showCancel && (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary !h-11 !px-5"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`${btnStyle} !h-11 !px-6`}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
      </FocusLock>
    </div>,
    document.body
  );
};

export default ConfirmationModal;
