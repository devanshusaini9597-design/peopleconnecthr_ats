import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { authenticatedFetch } from '../utils/fetchUtils';
import AppLoadingScreen from './ui/AppLoadingScreen';
import { NotFoundPage } from './RouteErrorPage';
import { useAuth } from '../context/AuthContext';
import { BASE_API_URL } from '../config';

function OperatorSignIn({ onSignedIn }) {
  const { login, acceptSession, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [step, setStep] = useState('password');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finishIfOperator = async (data) => {
    if (!data?.user?.isPlatformOperator) {
      await logout();
      setStep('password');
      setOtpToken('');
      setOtpCode('');
      setError('This console is only for the platform owner account.');
      return false;
    }
    acceptSession(data);
    onSignedIn?.();
    return true;
  };

  const onPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await login(email.trim(), password);
      if (data?.requiresOtp) {
        setOtpToken(data.otpToken || '');
        setStep('otp');
        if (data.emailSent === false && data.message) setError(data.message);
        return;
      }
      if (data?.requiresMfa || data?.requiresMfaEnrollment) {
        setError('This account needs the product sign-in page for authenticator setup.');
        return;
      }
      await finishIfOperator(data);
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  const onOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${BASE_API_URL}/api/auth/verify-login-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otpToken, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.displayMessage || data.message || 'Invalid code.');
      await finishIfOperator(data);
    } catch (err) {
      setError(err.message || 'Could not verify code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#f2faf8] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">People Connect HR</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">Platform operator</h1>
          <p className="mt-2 text-sm text-stone-500">Private SaaS control plane. Only the platform owner account can sign in here.</p>
        </div>

        <form
          onSubmit={step === 'otp' ? onOtpSubmit : onPasswordSubmit}
          className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[var(--shadow-card)] space-y-4 relative overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          {error ? (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>
          ) : null}

          {step === 'password' ? (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-stone-500">Operator email</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-ats mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-stone-500">Password</span>
                <div className="mt-1 relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-ats w-full !pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <label className="block">
              <span className="text-xs font-semibold text-stone-500">Email code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="input-ats mt-1 w-full"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {step === 'otp' ? 'Verify code' : 'Open console'}
          </button>
        </form>
      </div>
    </div>
  );
}

function useOpsHealth(enabled) {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let stop = false;
    const ping = async () => {
      try {
        const res = await authenticatedFetch('/api/platform/health');
        const json = await res.json();
        if (!stop && res.ok) setHealth(json.data || null);
      } catch {
        /* keep last good reading */
      }
    };
    ping();
    const id = window.setInterval(ping, 30000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [enabled]);
  return health;
}

export default function PlatformOpsPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const health = useOpsHealth(Boolean(isAuthenticated && user?.isPlatformOperator));

  useEffect(() => {
    document.title = 'Platform operator';
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow, noarchive');
  }, []);

  if (isLoading) {
    return <AppLoadingScreen message="Opening console" subMessage="Checking operator session…" />;
  }

  if (isAuthenticated && !user?.isPlatformOperator) {
    return <NotFoundPage />;
  }

  if (isAuthenticated && user?.isPlatformOperator) {
    const nav = [
      { to: '/pchr-ops', label: 'Overview', end: true },
      { to: '/pchr-ops/workspaces', label: 'Workspaces' },
      { to: '/pchr-ops/modules', label: 'Modules' },
      { to: '/pchr-ops/demo', label: 'Demo' },
      { to: '/pchr-ops/trials', label: 'Trials' },
    ];
    return (
      <div className="min-h-dvh bg-stone-950 text-stone-100 flex">
        <aside className="w-56 shrink-0 border-r border-stone-800 bg-stone-950 flex flex-col">
          <div className="h-14 px-4 border-b border-stone-800 flex flex-col justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-400">People Connect HR</p>
            <p className="text-sm font-semibold">Platform</p>
          </div>
          <nav className="p-2 space-y-0.5">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white hover:bg-stone-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto p-4 border-t border-stone-800">
            <p className="text-[11px] text-stone-500 truncate">{user.email}</p>
            <button type="button" onClick={() => logout()} className="mt-2 text-xs font-semibold text-stone-300 hover:text-white">
              Sign out
            </button>
          </div>
        </aside>
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 border-b border-stone-800 flex items-center justify-between px-6 gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-400">Production · peopleconnecthr.com</p>
              <p className="text-[10px] text-stone-600 truncate">
                {health?.ok ? `Live · ${health.latencyMs}ms · ${health.clients} clients` : health ? 'API degraded' : 'Connecting…'}
                {health?.generatedAt ? ` · ${new Date(health.generatedAt).toLocaleTimeString()}` : ''}
              </p>
            </div>
            <Link to="/dashboard" className="text-xs font-semibold text-teal-400 hover:text-teal-300 whitespace-nowrap">
              Open ATS
            </Link>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return <OperatorSignIn />;
}
