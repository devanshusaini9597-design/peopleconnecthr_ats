'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Login failed');
        return;
      }
      localStorage.setItem('portal_token', json.token);
      document.cookie = `portal_session=${encodeURIComponent(json.token)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      router.push('/portal/privacy');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl p-8 shadow-sm">
        <h1 className="text-xl font-bold text-stone-900">Candidate Portal</h1>
        <p className="text-sm text-stone-500 mt-1 mb-6">Sign in to manage your applications and privacy settings.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-stone-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-xs text-stone-500 mt-4 text-center">
          <Link href="/portal/privacy" className="text-teal-700 font-medium hover:underline">
            Privacy &amp; GDPR
          </Link>
        </p>
      </div>
    </div>
  );
}
