'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';

const BOARDS = [
  { id: 'LINKEDIN', label: 'LinkedIn', fields: ['accessToken', 'accountName'] as const, hint: 'OAuth access token + companyId in settings JSON' },
  { id: 'INDEED', label: 'Indeed', fields: ['apiKey', 'apiSecret', 'accountName'] as const, hint: 'Employer API key / secret' },
  { id: 'GLASSDOOR', label: 'Glassdoor', fields: ['apiKey', 'apiSecret', 'accountName'] as const, hint: 'Partner API key / secret' },
] as const;

export default function JobBoardCredentialsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, { configured: boolean }>>({});
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({
    LINKEDIN: { accessToken: '', accountName: '', settings: '{"companyId":""}' },
    INDEED: { apiKey: '', apiSecret: '', accountName: '' },
    GLASSDOOR: { apiKey: '', apiSecret: '', accountName: '' },
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/jobboards/credentials', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        const map: Record<string, { configured: boolean }> = {};
        for (const c of json.credentials || []) map[c.board] = { configured: c.configured };
        setStatus(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async (board: string) => {
    setSaving(board);
    setMsg('');
    const f = forms[board] || {};
    const body: Record<string, unknown> = { board, isActive: true };
    for (const [k, v] of Object.entries(f)) {
      if (!v) continue;
      if (k === 'settings') {
        try {
          body.settings = JSON.parse(v);
        } catch {
          setMsg('Invalid settings JSON');
          setSaving(null);
          return;
        }
      } else {
        body[k] = v;
      }
    }
    const res = await fetch('/api/jobboards/credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(null);
    if (!res.ok) {
      setMsg(json.error || 'Save failed');
      return;
    }
    setStatus((s) => ({ ...s, [board]: { configured: !!json.configured } }));
    setMsg(`${board} credentials saved. Existing draft workflow unchanged for boards without keys.`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">
        Connect your employer accounts. Without credentials, posting still creates draft DB records so current tenants are unaffected.
      </p>
      {BOARDS.map((b) => (
        <div key={b.id} className="rounded-xl border border-stone-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900">{b.label}</h3>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status[b.id]?.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
              {status[b.id]?.configured ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500">{b.hint}</p>
          {b.id === 'LINKEDIN' && (
            <>
              <input
                placeholder="Access token"
                type="password"
                value={forms.LINKEDIN.accessToken}
                onChange={(e) => setForms({ ...forms, LINKEDIN: { ...forms.LINKEDIN, accessToken: e.target.value } })}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
              />
              <input
                placeholder='Settings JSON e.g. {"companyId":"123"}'
                value={forms.LINKEDIN.settings}
                onChange={(e) => setForms({ ...forms, LINKEDIN: { ...forms.LINKEDIN, settings: e.target.value } })}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm font-mono"
              />
            </>
          )}
          {(b.id === 'INDEED' || b.id === 'GLASSDOOR') && (
            <>
              <input
                placeholder="API key"
                type="password"
                value={forms[b.id].apiKey}
                onChange={(e) => setForms({ ...forms, [b.id]: { ...forms[b.id], apiKey: e.target.value } })}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
              />
              <input
                placeholder="API secret"
                type="password"
                value={forms[b.id].apiSecret}
                onChange={(e) => setForms({ ...forms, [b.id]: { ...forms[b.id], apiSecret: e.target.value } })}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
              />
            </>
          )}
          <button
            type="button"
            onClick={() => save(b.id)}
            disabled={saving === b.id}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold disabled:opacity-60"
          >
            {saving === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save {b.label}
          </button>
        </div>
      ))}
      {msg && <p className="text-sm text-stone-600">{msg}</p>}
    </div>
  );
}
