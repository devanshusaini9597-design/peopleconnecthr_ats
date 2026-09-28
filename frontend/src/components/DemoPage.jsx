import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Building2, Shield, Users, RefreshCw, Sparkles,
} from 'lucide-react';
import { BASE_API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

export default function DemoPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [roles, setRoles] = useState([]);
  const [company, setCompany] = useState('Northstar Talent (Demo)');
  const [error, setError] = useState('');
  const [entering, setEntering] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_API_URL}/api/demo/roles`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Demo is not available');
        if (!cancelled) {
          setRoles(data.roles || []);
          setCompany(data.company || company);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Demo is not available');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enter = async (role) => {
    setEntering(role);
    setError('');
    try {
      const res = await fetch(`${BASE_API_URL}/api/demo/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
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
          <Sparkles size={12} /> Sales demo · not a real company
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-stone-950">
          Try every role in one click
        </h1>
        <p className="mt-3 max-w-2xl text-stone-600 leading-relaxed">
          Opens the sample company <span className="font-semibold text-stone-800">{company}</span>.
          No password. Switch roles anytime from the black bar inside the product.
          Real customer accounts and live email are never used here.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-sm text-stone-600">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5">
            <Users size={14} className="text-brand-600" /> {roles.length || 9} roles
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5">
            <RefreshCw size={14} className="text-brand-600" /> Switch without signing out
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5">
            <Shield size={14} className="text-brand-600" /> Isolated demo tenant
          </span>
        </div>

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

        <p className="mt-10 flex items-start gap-2 text-xs text-stone-500 max-w-2xl">
          <Shield size={14} className="mt-0.5 flex-shrink-0" />
          Share this page: <span className="font-mono text-stone-700">/demo</span>. Sample people, jobs, interviews, and MIS contacts only.
        </p>
      </main>
    </div>
  );
}
