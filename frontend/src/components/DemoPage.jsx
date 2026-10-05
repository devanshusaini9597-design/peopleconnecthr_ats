import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Building2, Shield, Lock,
} from 'lucide-react';
import { BASE_API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import {
  getDemoAccessKey,
  storeDemoAccessKey,
  demoKeyHeaders,
} from '../utils/demoAccess';

export default function DemoPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const urlKey = String(searchParams.get('k') || searchParams.get('access') || '').trim();
  const accessKey = useMemo(() => urlKey || getDemoAccessKey(), [urlKey]);

  const [roles, setRoles] = useState([]);
  const [company, setCompany] = useState('Northstar Talent (Demo)');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(!accessKey);
  const [entering, setEntering] = useState('');

  useEffect(() => {
    if (urlKey) storeDemoAccessKey(urlKey);
  }, [urlKey]);

  useEffect(() => {
    if (!accessKey) {
      setLocked(true);
      setRoles([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_API_URL}/api/demo/roles`, {
          headers: { 'X-Demo-Key': accessKey },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Private demo link required');
        if (!cancelled) {
          setLocked(false);
          setRoles(data.roles || []);
          setCompany(data.company || company);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setLocked(true);
          setRoles([]);
          setError(err.message || 'Private demo link required');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [accessKey]);

  const enter = async (role) => {
    if (!accessKey) return;
    setEntering(role);
    setError('');
    try {
      const res = await fetch(`${BASE_API_URL}/api/demo/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Demo-Key': accessKey,
        },
        credentials: 'include',
        body: JSON.stringify({ role, k: accessKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not open this role');
      window.location.assign(data.redirectTo || '/dashboard');
    } catch (err) {
      setError(err.message || 'Could not open this role');
      setEntering('');
    }
  };

  const realSession = isAuthenticated && user && !user.isDemo;
  const alreadyDemo = isAuthenticated && user?.isDemo;

  if (locked) {
    return (
      <div className="min-h-dvh bg-[#f6f5f2] text-stone-900 flex flex-col">
        <header className="max-w-lg mx-auto w-full px-4 pt-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="w-9 h-9 rounded-xl object-cover" />
            <span className="font-bold tracking-tight">People Connect HR</span>
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 pb-16">
          <div className="max-w-md w-full rounded-3xl border border-stone-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-stone-100 text-stone-600 flex items-center justify-center">
              <Lock size={20} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-stone-950">Private demo</h1>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              This walkthrough is invite-only. Open the private link you were shared — it is not listed on the website.
            </p>
            {error ? (
              <p className="mt-4 text-sm text-rose-700">{error}</p>
            ) : null}
            <Link to="/login" className="mt-6 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-800">
              Customer login
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#ecfdf5_0%,_#f6f5f2_42%,_#f6f5f2_100%)] text-stone-900">
      <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="w-9 h-9 rounded-xl object-cover" />
          <span className="font-bold tracking-tight">People Connect HR</span>
        </Link>
        <div className="flex items-center gap-3">
          {alreadyDemo ? (
            <Link to="/dashboard" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              Back to workspace
            </Link>
          ) : null}
          <Link to="/login" className="text-sm font-semibold text-stone-600 hover:text-brand-700">
            Customer login
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
          <Shield size={12} /> Private sales demo
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-stone-950">
          Walk the product as any role
        </h1>
        <p className="mt-3 max-w-2xl text-stone-600 leading-relaxed">
          Sample company <span className="font-semibold text-stone-800">{company}</span>.
          No password. Switch roles from the bar inside the product. This link is not public.
        </p>

        {realSession && !isLoading ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            You are signed in as {user.name || user.email}. Opening a demo role replaces that session in this browser until you sign in again.
          </div>
        ) : null}

        {alreadyDemo && !isLoading ? (
          <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-950">
            You are already in the demo as {user.name} ({user.role}). Pick another role below, or use the switcher in the product.
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        ) : null}

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => {
            const active = alreadyDemo && user?.role === role.role;
            return (
              <button
                key={role.role}
                type="button"
                disabled={!!entering}
                onClick={() => enter(role.role)}
                className={`text-left rounded-2xl border p-5 shadow-sm transition disabled:opacity-60 ${
                  active
                    ? 'border-brand-400 bg-brand-50/70 ring-2 ring-brand-300'
                    : 'border-stone-200 bg-white hover:border-brand-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-400">{role.title}</p>
                    <p className="mt-1 text-lg font-semibold text-stone-950">{role.name}</p>
                  </div>
                  <span className="h-9 w-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} />
                  </span>
                </div>
                <p className="mt-3 text-sm text-stone-600 leading-relaxed min-h-12">{role.summary}</p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                  {entering === role.role ? 'Opening…' : active ? 'Reopen this role' : 'Open this role'}
                  <ArrowRight size={14} />
                </p>
              </button>
            );
          })}
        </div>

        {!roles.length && !error ? (
          <p className="mt-8 text-sm text-stone-500">Loading roles…</p>
        ) : null}
      </main>
    </div>
  );
}
