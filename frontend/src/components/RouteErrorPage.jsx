import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home, ShieldOff, SearchX, ArrowLeft } from 'lucide-react';

const CHUNK_RELOAD_KEY = 'skillnix_chunk_reload_v1';

export function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  const name = String(error?.name || '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg)
    || /Importing a module script failed/i.test(msg)
    || /error loading dynamically imported module/i.test(msg)
    || /Loading chunk [\d]+ failed/i.test(msg)
    || /ChunkLoadError/i.test(name)
    || /ChunkLoadError/i.test(msg)
  );
}

function classifyError(error) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      return {
        code: '403',
        title: 'Access denied',
        message: 'You do not have permission to view this page. Ask an admin if you need access.',
        Icon: ShieldOff,
        tone: 'amber',
      };
    }
    if (error.status === 404) {
      return {
        code: '404',
        title: 'Page not found',
        message: 'This link may be outdated, or the page was moved.',
        Icon: SearchX,
        tone: 'stone',
      };
    }
    return {
      code: String(error.status || 'Error'),
      title: error.statusText || 'Something went wrong',
      message: typeof error.data === 'string' ? error.data : 'Please try again or return to the dashboard.',
      Icon: AlertTriangle,
      tone: 'rose',
    };
  }

  if (isChunkLoadError(error)) {
    return {
      code: 'Update',
      title: 'A newer version is available',
      message: 'The app was updated while this tab was open. Reload to continue — your work is safe.',
      Icon: RefreshCw,
      tone: 'teal',
      chunk: true,
    };
  }

  if (error && typeof error === 'object' && error.__kind === '403') {
    return {
      code: '403',
      title: 'Access denied',
      message: error.message || 'You do not have permission to view this page.',
      Icon: ShieldOff,
      tone: 'amber',
    };
  }

  if (error && typeof error === 'object' && error.__kind === '404') {
    return {
      code: '404',
      title: 'Page not found',
      message: error.message || 'This link may be outdated, or the page was moved.',
      Icon: SearchX,
      tone: 'stone',
    };
  }

  return {
    code: 'Error',
    title: 'Something went wrong',
    message: 'This page could not be loaded. Reload, or go back to the dashboard.',
    Icon: AlertTriangle,
    tone: 'rose',
  };
}

const TONE = {
  teal: {
    wrap: 'from-teal-50 via-white to-stone-50',
    icon: 'bg-teal-100 text-teal-800',
    code: 'text-teal-700 bg-teal-50 border-teal-200',
    bar: 'from-brand-500 via-teal-400 to-brand-600',
  },
  amber: {
    wrap: 'from-amber-50 via-white to-stone-50',
    icon: 'bg-amber-100 text-amber-800',
    code: 'text-amber-800 bg-amber-50 border-amber-200',
    bar: 'from-amber-500 via-orange-400 to-amber-600',
  },
  stone: {
    wrap: 'from-stone-100 via-white to-stone-50',
    icon: 'bg-stone-200 text-stone-700',
    code: 'text-stone-700 bg-stone-100 border-stone-200',
    bar: 'from-stone-400 via-stone-300 to-stone-500',
  },
  rose: {
    wrap: 'from-rose-50 via-white to-stone-50',
    icon: 'bg-rose-100 text-rose-800',
    code: 'text-rose-700 bg-rose-50 border-rose-200',
    bar: 'from-rose-500 via-red-400 to-rose-600',
  },
};

function ErrorPanel({ info, titleOverride, messageOverride, debugError }) {
  const navigate = useNavigate();
  const tone = TONE[info.tone] || TONE.rose;
  const Icon = info.Icon;
  const title = titleOverride || info.title;
  const message = messageOverride || info.message;

  useEffect(() => {
    if (!info.chunk) return undefined;
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return undefined;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
      window.location.reload();
    } catch {
      /* ignore */
    }
    return undefined;
  }, [info.chunk]);

  const reload = () => {
    try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* ignore */ }
    window.location.reload();
  };

  return (
    <div className={`min-h-[70vh] flex items-center justify-center px-4 py-10 bg-gradient-to-b ${tone.wrap}`}>
      <div className="w-full max-w-lg rounded-2xl border border-stone-200/90 bg-white shadow-xl shadow-stone-900/8 overflow-hidden">
        <div className={`h-1 bg-gradient-to-r ${tone.bar}`} />
        <div className="p-6 sm:p-8 text-center">
          <div className="flex justify-center">
            <span className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${tone.icon}`}>
              <Icon className="w-7 h-7" strokeWidth={2} />
            </span>
          </div>

          <span className={`mt-4 inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-bold tracking-wide ${tone.code}`}>
            {info.code}
          </span>

          <h1 className="mt-3 text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-sm text-stone-500 leading-relaxed max-w-md mx-auto">
            {message}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
            <button type="button" onClick={reload} className="btn-primary">
              <RefreshCw className="w-4 h-4" />
              {info.chunk ? 'Reload app' : 'Try again'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
              <ArrowLeft className="w-4 h-4" />
              Go back
            </button>
            <Link to="/dashboard" className="btn-secondary">
              <Home className="w-4 h-4" />
              Dashboard
            </Link>
          </div>

          {import.meta.env.DEV && debugError ? (
            <pre className="mt-6 text-left text-[10px] leading-relaxed text-stone-400 bg-stone-50 border border-stone-100 rounded-xl p-3 overflow-auto max-h-28">
              {String(debugError?.stack || debugError?.message || debugError)}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** React Router `errorElement` — catches lazy/chunk failures and route errors */
export default function RouteErrorPage() {
  const routeError = useRouteError();
  const info = useMemo(() => classifyError(routeError), [routeError]);
  return <ErrorPanel info={info} debugError={routeError} />;
}

export function ForbiddenPage({ message } = {}) {
  const info = useMemo(
    () => classifyError({ __kind: '403', message }),
    [message]
  );
  return <ErrorPanel info={info} />;
}

export function NotFoundPage() {
  const info = useMemo(() => classifyError({ __kind: '404' }), []);
  return <ErrorPanel info={info} />;
}
