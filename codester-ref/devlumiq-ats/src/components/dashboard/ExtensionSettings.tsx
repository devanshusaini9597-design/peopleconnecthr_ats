'use client';

import { useEffect, useState } from 'react';
import { Loader2, Copy, Check, Plus, Trash2, Chrome, ExternalLink } from 'lucide-react';

interface TokenRow {
  id: string;
  maskedToken: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export default function ExtensionSettings() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const domain =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || '';

  const load = async () => {
    const res = await fetch('/api/settings/extension-token', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setTokens(json.tokens || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createToken = async () => {
    setCreating(true);
    setRawToken(null);
    try {
      const res = await fetch('/api/settings/extension-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ expiresInDays: 365 }),
      });
      const json = await res.json();
      if (res.ok && json.token) {
        setRawToken(json.token);
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    await fetch('/api/settings/extension-token', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    });
    await load();
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 text-sm text-stone-700">
        <div className="flex items-start gap-3">
          <Chrome className="w-5 h-5 text-teal-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-stone-900">Chrome LinkedIn Import</p>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Load the unpacked extension from the <code className="text-[11px] bg-white px-1 rounded border">chrome-extension/</code> folder,
              paste your ATS domain and a token below, then import LinkedIn profiles in one click.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Your ATS domain</label>
        <div className="mt-1.5 flex gap-2">
          <input
            readOnly
            value={domain}
            className="flex-1 px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => copy(domain, 'domain')}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700"
          >
            {copied === 'domain' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {rawToken && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold text-amber-900 mb-2">Copy this token now — it won&apos;t be shown again</p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs break-all bg-white border border-amber-100 rounded-lg px-3 py-2 font-mono">
              {rawToken}
            </code>
            <button
              type="button"
              onClick={() => copy(rawToken, 'token')}
              className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold"
            >
              {copied === 'token' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">Extension tokens</h3>
        <button
          type="button"
          onClick={createToken}
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold disabled:opacity-60"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Generate token
        </button>
      </div>

      <ul className="space-y-2">
        {tokens.length === 0 && (
          <li className="text-sm text-stone-500 py-4 text-center border border-dashed border-stone-200 rounded-xl">
            No tokens yet — generate one to connect the extension.
          </li>
        )}
        {tokens.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-stone-200 bg-white"
          >
            <div className="min-w-0">
              <p className="text-sm font-mono text-stone-800 truncate">{t.maskedToken}</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {t.isActive ? 'Active' : 'Revoked'} · created {new Date(t.createdAt).toLocaleDateString()}
                {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : ''}
              </p>
            </div>
            {t.isActive && (
              <button
                type="button"
                onClick={() => revoke(t.id)}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                title="Revoke"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <a
        href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
      >
        How to load an unpacked extension <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
