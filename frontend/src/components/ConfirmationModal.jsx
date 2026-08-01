import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, Share2, Edit2, CheckCircle, X, Loader2, Info, ShieldAlert } from 'lucide-react';

const iconMap = {
  delete: { icon: Trash2, bg: 'bg-red-100', color: 'text-red-600', ring: 'ring-red-100' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-100', color: 'text-amber-600', ring: 'ring-amber-100' },
  share: { icon: Share2, bg: 'bg-emerald-100', color: 'text-emerald-600', ring: 'ring-emerald-100' },
  edit: { icon: Edit2, bg: 'bg-brand-100', color: 'text-brand-600', ring: 'ring-brand-100' },
  success: { icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600', ring: 'ring-green-100' },
  info: { icon: Info, bg: 'bg-sky-100', color: 'text-sky-600', ring: 'ring-sky-100' },
  danger: { icon: ShieldAlert, bg: 'bg-red-100', color: 'text-red-600', ring: 'ring-red-100' },
};

const buttonStyles = {
  delete: 'btn-danger',
  warning: 'btn-primary !bg-amber-600 hover:!bg-amber-700 !shadow-amber-500/25',
  share: 'btn-primary',
  edit: 'btn-primary',
  success: 'btn-primary !from-emerald-600 !via-emerald-600 !to-emerald-700',
  info: 'btn-primary !from-sky-600 !via-sky-600 !to-sky-700',
  danger: 'btn-danger',
  default: 'btn-primary',
};

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = '',
  details = null,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false,
  showCancel = true,
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

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fade-in"
      onClick={!isLoading ? onClose : undefined}
    >
      <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm" aria-hidden />
      <div
        className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md border border-stone-200/60 overflow-hidden modal-panel-ats"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />

        <div className="flex items-start gap-4 p-6 pb-3">
          <div className={`w-12 h-12 ${iconConfig.bg} rounded-2xl flex items-center justify-center flex-shrink-0 ring-4 ${iconConfig.ring}`}>
            <IconComponent size={22} className={iconConfig.color} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-stone-900 tracking-tight">{title}</h3>
            {message && (
              <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">{message}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors flex-shrink-0 text-stone-400 hover:text-stone-600"
          >
            <X size={18} />
          </button>
        </div>

        {details && (
          <div className="px-6 py-2">
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
              {typeof details === 'string' ? (
                <p className="text-sm text-stone-700">{details}</p>
              ) : (
                details
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 p-6 pt-4">
          {showCancel && (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary flex-1"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`${btnStyle} flex-1`}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
