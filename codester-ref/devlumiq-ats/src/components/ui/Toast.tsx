'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  createdAt: number;
  persistent?: boolean;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (options: Omit<ToastItem, 'id' | 'createdAt'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  loading: (title: string, message?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const STYLES: Record<ToastType, { icon: string; bar: string; glow: string }> = {
  success: {
    icon: 'from-emerald-500 to-teal-500',
    bar: 'from-emerald-500 to-teal-400',
    glow: '0 8px 30px -4px rgba(16,185,129,0.2)',
  },
  error: {
    icon: 'from-red-500 to-rose-500',
    bar: 'from-red-500 to-rose-400',
    glow: '0 8px 30px -4px rgba(239,68,68,0.2)',
  },
  warning: {
    icon: 'from-amber-500 to-orange-500',
    bar: 'from-amber-500 to-orange-400',
    glow: '0 8px 30px -4px rgba(245,158,11,0.2)',
  },
  info: {
    icon: 'from-brand-500 to-teal-500',
    bar: 'from-brand-500 to-teal-400',
    glow: '0 8px 30px -4px rgba(13,148,136,0.2)',
  },
  loading: {
    icon: 'from-blue-500 to-indigo-500',
    bar: 'from-blue-500 to-indigo-400',
    glow: '0 8px 30px -4px rgba(59,130,246,0.2)',
  },
};

const DEFAULT_DURATION = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback(
    (options: Omit<ToastItem, 'id' | 'createdAt'>) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = options.duration ?? DEFAULT_DURATION;
      const item: ToastItem = { ...options, id, createdAt: Date.now(), duration };

      setToasts((prev) => [...prev.slice(-4), item]);

      if (!options.persistent && duration > 0) {
        const tid = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, tid);
      }
      return id;
    },
    [dismiss],
  );

  const success = useCallback((title: string, message?: string) => addToast({ type: 'success', title, message, duration: 3500 }), [addToast]);
  const error = useCallback((title: string, message?: string) => addToast({ type: 'error', title, message, duration: 6000 }), [addToast]);
  const warning = useCallback((title: string, message?: string) => addToast({ type: 'warning', title, message, duration: 5000 }), [addToast]);
  const info = useCallback((title: string, message?: string) => addToast({ type: 'info', title, message, duration: 4000 }), [addToast]);
  const loading = useCallback((title: string, message?: string) => addToast({ type: 'loading', title, message, persistent: true, duration: 0 }), [addToast]);

  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout); };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast: addToast, success, error, warning, info, loading, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none"
        style={{ width: 'min(380px, calc(100vw - 2rem))' }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const Icon = ICONS[item.type];
  const style = STYLES[item.type];
  const duration = item.duration || DEFAULT_DURATION;

  const progress = useMotionValue(1);
  const scaleX = useTransform(progress, [1, 0], [1, 0]);
  const controlRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (item.persistent || duration <= 0) return;
    controlRef.current = animate(progress, 0, {
      duration: duration / 1000,
      ease: 'linear',
    });
    return () => { controlRef.current?.stop(); };
  }, [duration, item.persistent, progress]);

  const handleMouseEnter = () => { controlRef.current?.pause(); };
  const handleMouseLeave = () => { controlRef.current?.play(); };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="alert"
      className="pointer-events-auto relative overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-lg backdrop-blur-xl"
      style={{ boxShadow: style.glow }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className={`flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br ${style.icon} flex items-center justify-center shadow-sm`}>
          <Icon className={`w-4 h-4 text-white ${item.type === 'loading' ? 'animate-spin' : ''}`} strokeWidth={2.5} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-semibold text-stone-900 text-[13px] leading-snug">{item.title}</p>
          {item.message && (
            <p className="text-stone-500 text-xs mt-0.5 leading-relaxed line-clamp-2">{item.message}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="flex-shrink-0 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors -mt-0.5 -mr-1"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>

      {!item.persistent && (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-stone-100/60">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${style.bar} origin-left`}
            style={{ scaleX }}
          />
        </div>
      )}
    </motion.div>
  );
}
