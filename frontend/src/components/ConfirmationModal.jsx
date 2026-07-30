import React from 'react';
import { AlertTriangle, Trash2, Share2, Edit2, CheckCircle, X, Loader2, Info, ShieldAlert } from 'lucide-react';

const iconMap = {
  delete: { icon: Trash2, bg: 'bg-red-100', color: 'text-red-600' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-100', color: 'text-amber-600' },
  share: { icon: Share2, bg: 'bg-emerald-100', color: 'text-emerald-600' },
  edit: { icon: Edit2, bg: 'bg-blue-100', color: 'text-blue-600' },
  success: { icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600' },
  info: { icon: Info, bg: 'bg-sky-100', color: 'text-sky-600' },
  danger: { icon: ShieldAlert, bg: 'bg-red-100', color: 'text-red-600' },
};

const buttonStyles = {
  delete: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white',
  share: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  edit: 'bg-blue-600 hover:bg-blue-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  info: 'bg-sky-600 hover:bg-sky-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  default: 'bg-blue-600 hover:bg-blue-700 text-white',
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
  if (!isOpen) return null;

  const iconConfig = iconMap[type] || iconMap.warning;
  const IconComponent = iconConfig.icon;
  const btnStyle = buttonStyles[type] || buttonStyles.default;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-[1px]" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'confirmModalIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-2">
          <div className={`w-12 h-12 ${iconConfig.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
            <IconComponent size={22} className={iconConfig.color} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            {message && (
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{message}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Details section */}
        {details && (
          <div className="px-6 py-3">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              {typeof details === 'string' ? (
                <p className="text-sm text-gray-700">{details}</p>
              ) : (
                details
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-4">
          {showCancel && (
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${btnStyle}`}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confirmModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ConfirmationModal;
