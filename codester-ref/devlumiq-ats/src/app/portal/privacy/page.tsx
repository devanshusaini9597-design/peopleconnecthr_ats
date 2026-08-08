'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('portal_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function PortalPrivacyPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<'export' | 'erase' | null>(null);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState('');
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (!token) {
      router.replace('/portal/login');
      return;
    }
    setAuthed(true);
  }, [router]);

  const exportData = async () => {
    setBusy('export');
    setMessage('');
    try {
      const res = await fetch('/api/portal/gdpr/export', { headers: authHeaders() });
      if (res.status === 401) {
        router.replace('/portal/login');
        return;
      }
      if (!res.ok) {
        setMessage('Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Your data export has been downloaded.');
    } finally {
      setBusy(null);
    }
  };

  const eraseData = async () => {
    if (confirm !== 'DELETE MY DATA') {
      setMessage('Type DELETE MY DATA exactly to confirm.');
      return;
    }
    setBusy('erase');
    setMessage('');
    try {
      const res = await fetch('/api/portal/gdpr/erase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ confirmation: 'DELETE MY DATA' }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || 'Erasure failed');
        return;
      }
      localStorage.removeItem('portal_token');
      setMessage(json.message);
      setTimeout(() => router.replace('/portal/login'), 2500);
    } finally {
      setBusy(null);
    }
  };

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-sm font-bold text-stone-900">Candidate Privacy</h1>
          <Link href="/portal/login" className="text-xs text-stone-500 hover:text-stone-800">
            Portal login
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Your data rights</h2>
          <p className="text-sm text-stone-600 mt-2 leading-relaxed">
            Under GDPR you can export a copy of your personal data (Article 20) or request erasure (Article 17).
            These actions apply to data linked to your candidate portal account.
          </p>
        </div>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 space-y-3">
          <h3 className="font-bold text-stone-900">Export my data</h3>
          <p className="text-sm text-stone-500">Download a JSON file with your profile, applications, and related records.</p>
          <button
            type="button"
            onClick={exportData}
            disabled={busy !== null}
            className="px-4 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy === 'export' ? 'Preparing…' : 'Download export'}
          </button>
        </section>

        <section className="rounded-2xl border border-red-200 bg-white p-6 space-y-3">
          <h3 className="font-bold text-stone-900">Delete my data</h3>
          <p className="text-sm text-stone-500">
            Permanently anonymizes your personal information. Type <strong>DELETE MY DATA</strong> to confirm.
          </p>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE MY DATA"
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm font-mono"
          />
          <button
            type="button"
            onClick={eraseData}
            disabled={busy !== null}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy === 'erase' ? 'Erasing…' : 'Erase my data'}
          </button>
        </section>

        {message && (
          <p className="text-sm text-stone-700 bg-stone-100 border border-stone-200 rounded-xl px-4 py-3">{message}</p>
        )}
      </main>
    </div>
  );
}
