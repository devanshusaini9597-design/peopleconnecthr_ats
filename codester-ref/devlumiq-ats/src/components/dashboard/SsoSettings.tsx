'use client';

import { useEffect, useState } from 'react';
import { Loader2, Shield, Copy, Check, Save } from 'lucide-react';

export default function SsoSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entitled, setEntitled] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [sp, setSp] = useState<{ entityId: string; acsUrl: string; metadataUrl: string } | null>(null);
  const [form, setForm] = useState({
    enabled: false,
    entryPoint: '',
    issuer: '',
    cert: '',
    emailAttribute: 'email',
    wantAssertionsSigned: true,
    hasCert: false,
  });

  useEffect(() => {
    fetch('/api/settings/sso', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        setEntitled(!!json.entitled);
        setSp(json.sp || null);
        if (json.config) {
          setForm((f) => ({
            ...f,
            enabled: json.config.enabled,
            entryPoint: json.config.entryPoint || '',
            issuer: json.config.issuer || '',
            emailAttribute: json.config.emailAttribute || 'email',
            wantAssertionsSigned: json.config.wantAssertionsSigned !== false,
            hasCert: !!json.config.hasCert,
          }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings/sso', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: form.enabled,
          entryPoint: form.entryPoint,
          issuer: form.issuer,
          cert: form.cert || undefined,
          emailAttribute: form.emailAttribute,
          wantAssertionsSigned: form.wantAssertionsSigned,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || 'Save failed');
        return;
      }
      setMessage('SSO settings saved. Password login remains available.');
      setForm((f) => ({ ...f, hasCert: json.config?.hasCert || f.hasCert, cert: '' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!entitled) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center">
        <Shield className="w-8 h-8 text-stone-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-stone-800">SSO / SAML</p>
        <p className="text-xs text-stone-500 mt-1">
          Available on Enterprise (or SSO add-on). Email/password login is unchanged for all plans.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sp && (
        <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 space-y-2 text-xs">
          <p className="font-bold text-stone-800 text-sm">Service Provider (give these to your IdP)</p>
          {[
            ['Entity ID', sp.entityId, 'entity'],
            ['ACS URL', sp.acsUrl, 'acs'],
            ['Metadata', sp.metadataUrl, 'meta'],
          ].map(([label, value, key]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="w-20 text-stone-500 flex-shrink-0 pt-1">{label}</span>
              <code className="flex-1 break-all bg-white border border-stone-100 rounded px-2 py-1">{value}</code>
              <button type="button" onClick={() => copy(String(value), key)} className="p-1.5 rounded border border-stone-200 bg-white">
                {copied === key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center justify-between py-2">
        <span className="text-sm font-medium text-stone-800">Enable SSO for this organization</span>
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          className="w-4 h-4"
        />
      </label>

      <div>
        <label className="text-xs font-semibold text-stone-500">IdP SSO URL (Entry Point)</label>
        <input
          value={form.entryPoint}
          onChange={(e) => setForm({ ...form, entryPoint: e.target.value })}
          className="mt-1 w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm"
          placeholder="https://idp.example.com/sso/saml"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-stone-500">IdP Entity ID (Issuer)</label>
        <input
          value={form.issuer}
          onChange={(e) => setForm({ ...form, issuer: e.target.value })}
          className="mt-1 w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm"
          placeholder="https://idp.example.com/metadata"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-stone-500">
          IdP X.509 Certificate {form.hasCert ? '(saved — paste to replace)' : ''}
        </label>
        <textarea
          value={form.cert}
          onChange={(e) => setForm({ ...form, cert: e.target.value })}
          rows={4}
          className="mt-1 w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-mono"
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-stone-500">Email attribute</label>
        <input
          value={form.emailAttribute}
          onChange={(e) => setForm({ ...form, emailAttribute: e.target.value })}
          className="mt-1 w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save SSO settings
      </button>
      {message && <p className="text-sm text-stone-600">{message}</p>}
      <p className="text-xs text-stone-400">
        Users must already exist in this org (matched by email). SSO login URL:{' '}
        <code className="bg-stone-100 px-1 rounded">/api/auth/sso/login?slug=YOUR_SLUG</code>
      </p>
    </div>
  );
}
