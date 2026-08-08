'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showClose?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  full: 'max-w-[90vw] max-h-[90vh]',
};

export function Modal({ open, onClose, title, description, children, size = 'md', showClose = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-stone-900/55"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            aria-describedby={description ? 'modal-desc' : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full my-auto ${sizeClasses[size]} rounded-2xl sm:rounded-3xl border border-stone-200/60 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`}
          >
            {/* Top gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />
            
            {/* Header with title/description */}
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 p-4 sm:p-6 pb-0 flex-shrink-0">
                <div>
                  {title && (
                    <h2 id="modal-title" className="text-xl font-bold text-stone-900 tracking-tight">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id="modal-desc" className="text-stone-500 text-sm mt-1.5">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Close button positioned absolutely to avoid extra padding */}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors z-10"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

