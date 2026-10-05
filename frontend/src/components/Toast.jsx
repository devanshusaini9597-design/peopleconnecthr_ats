import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: (msg) => alert(msg),
      error: (msg) => alert(msg),
      warning: (msg) => alert(msg),
      info: (msg) => alert(msg),
    };
  }
  return ctx;
};

let globalToast = null;
export const toast = {
  success: (msg, dur, opts) => globalToast?.success(msg, dur, opts),
  error: (msg, dur, opts) => globalToast?.error(msg, dur, opts),
  warning: (msg, dur, opts) => globalToast?.warning(msg, dur, opts),
  info: (msg, dur, opts) => globalToast?.info(msg, dur, opts),
};

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: {
    bg: 'bg-white',
    border: 'border-emerald-200/90',
    icon: 'text-emerald-600',
    bar: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-white',
    border: 'border-red-200/90',
    icon: 'text-red-500',
    bar: 'bg-red-500',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-amber-200/90',
    icon: 'text-amber-500',
    bar: 'bg-amber-500',
  },
  info: {
    bg: 'bg-white',
    border: 'border-sky-200/90',
    icon: 'text-sky-600',
    bar: 'bg-sky-500',
  },
};

const ToastItem = ({ toast: t, onDismiss }) => {
  const Icon = ICONS[t.type] || Info;
  const style = STYLES[t.type] || STYLES.info;
  const durationMs = Math.max(1200, Number(t.duration) || 4000);

  return (
    <div
      className={`
        ${style.bg} ${style.border} border rounded-xl shadow-lg shadow-stone-900/10
        flex items-start gap-3 px-4 py-3 min-w-[300px] max-w-[420px]
        animate-slide-in-right relative overflow-hidden ring-1 ring-stone-900/5
      `}
      role="alert"
    >
      <div
        className={`absolute bottom-0 left-0 h-[2.5px] ${style.bar}`}
        style={{ animation: `shrinkWidth ${durationMs}ms linear forwards` }}
      />
      <Icon size={18} className={`${style.icon} flex-shrink-0 mt-0.5`} strokeWidth={2.25} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-stone-800 leading-5 tracking-tight">{t.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(t.id)}
        className="flex-shrink-0 p-0.5 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
        aria-label="Dismiss"
      >
        <X size={14} className="text-stone-400" />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration = 4000, opts = {}) => {
    const id = ++toastIdCounter;
    const safeMessage = message != null ? String(message) : '';
    const key = opts.key ? String(opts.key) : null;
    const dur = Number(duration) || 4000;

    setToasts((prev) => {
      let next = prev;
      // Replace any toast with the same key (enterprise: one status line, not a stack)
      if (key) {
        next = prev.filter((t) => {
          if (t.key !== key) return true;
          if (timersRef.current[t.id]) {
            clearTimeout(timersRef.current[t.id]);
            delete timersRef.current[t.id];
          }
          return false;
        });
      } else if (next.some((t) => t.type === type && t.message === safeMessage)) {
        return next;
      }
      // Cap visible stack — prefer newest
      return [...next.slice(-2), { id, type, message: safeMessage, key, duration: dur }];
    });

    timersRef.current[id] = setTimeout(() => dismiss(id), dur);
    return id;
  }, [dismiss]);

  const api = {
    success: (msg, dur, opts) => addToast('success', msg, dur, opts),
    error: (msg, dur, opts) => addToast('error', msg, dur || 6000, opts),
    warning: (msg, dur, opts) => addToast('warning', msg, dur, opts),
    info: (msg, dur, opts) => addToast('info', msg, dur, opts),
  };

  globalToast = api;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(12px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.22s ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
