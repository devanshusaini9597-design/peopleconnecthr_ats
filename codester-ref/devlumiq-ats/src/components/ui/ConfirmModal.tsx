'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, LogOut, Trash2 } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'primary' | 'neutral';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: ConfirmVariant;
  loading?: boolean;
}

const variantStyles: Record<ConfirmVariant, { icon: typeof AlertTriangle; btnClass: string; iconBg: string }> = {
  danger: {
    icon: Trash2,
    btnClass: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25',
    iconBg: 'bg-red-100 text-red-600',
  },
  primary: {
    icon: LogOut,
    btnClass: 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-500/25',
    iconBg: 'bg-brand-100 text-brand-600',
  },
  neutral: {
    icon: AlertTriangle,
    btnClass: 'bg-stone-700 hover:bg-stone-800 text-white',
    iconBg: 'bg-stone-100 text-stone-600',
  },
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const style = variantStyles[variant];
  const Icon = style.icon;

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-desc"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden"
          >
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${style.iconBg}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h2 id="confirm-modal-title" className="text-lg font-bold text-stone-900">
                    {title}
                  </h2>
                  <p id="confirm-modal-desc" className="text-stone-600 text-sm mt-1.5">
                    {description}
                  </p>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={() => { onConfirm(); }}
                  disabled={loading}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all disabled:opacity-70 ${style.btnClass}`}
                >
                  {loading ? '...' : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
