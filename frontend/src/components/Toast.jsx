import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback if outside provider — use alert
    return {
      success: (msg) => alert(msg),
      error: (msg) => alert(msg),
      warning: (msg) => alert(msg),
      info: (msg) => alert(msg),
    };
  }
  return ctx;
};

// Global toast function for use outside React components
let globalToast = null;
export const toast = {
  success: (msg) => globalToast?.success(msg),
  error: (msg) => globalToast?.error(msg),
  warning: (msg) => globalToast?.warning(msg),
  info: (msg) => globalToast?.info(msg),
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
    border: 'border-green-200',
    icon: 'text-green-500',
    bar: 'bg-green-500',
  },
  error: {
    bg: 'bg-white',
    border: 'border-red-200',
    icon: 'text-red-500',
    bar: 'bg-red-500',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    bar: 'bg-amber-500',
  },
  info: {
    bg: 'bg-white',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    bar: 'bg-blue-500',
  },
};

const ToastItem = ({ toast: t, onDismiss }) => {
  const Icon = ICONS[t.type] || Info;
  const style = STYLES[t.type] || STYLES.info;

  return (
    <div
      className={`
        ${style.bg} ${style.border} border rounded-xl shadow-lg
        flex items-start gap-3 px-4 py-3 min-w-[320px] max-w-[440px]
        animate-slide-in-right relative overflow-hidden
      `}
      role="alert"
    >
      {/* Progress bar */}
      <div className={`absolute bottom-0 left-0 h-[3px] ${style.bar} animate-shrink-width`} />
      
      <Icon size={20} className={`${style.icon} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-5">{t.message}</p>
      </div>
      <button
        onClick={() => onDismiss(t.id)}
        className="flex-shrink-0 p-0.5 hover:bg-gray-100 rounded transition-colors cursor-pointer"
      >
        <X size={14} className="text-gray-400" />
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

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = ++toastIdCounter;
    const safeMessage = message != null ? String(message) : '';
    const newToast = { id, type, message: safeMessage };
    setToasts((prev) => [...prev.slice(-4), newToast]); // max 5 toasts
    timersRef.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = {
    success: (msg, dur) => addToast('success', msg, dur),
    error: (msg, dur) => addToast('error', msg, dur || 6000),
    warning: (msg, dur) => addToast('warning', msg, dur),
    info: (msg, dur) => addToast('info', msg, dur),
  };

  // Set global ref
  globalToast = api;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast container - top right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }
        .animate-shrink-width {
          animation: shrinkWidth 4s linear forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
