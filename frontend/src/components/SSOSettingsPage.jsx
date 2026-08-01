import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Lock, Loader2, Save, Copy, Check } from 'lucide-react';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const CopyField = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input readOnly value={value} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-gray-50 font-mono" />
        <button onClick={copy} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
        </button>
      </div>
    </div>
  );
};

const SSOSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [urls, setUrls] = useState(null);
  const [form, setForm] = useState({
    enabled: false,
    entryPoint: '',
    idpIssuer: '',
    idpCert: '',
    wantAssertionsSigned: true,
    defaultRole: 'recruiter',
    jitProvisioning: true,
    attributeMap: { email: 'email', name: 'name' }
  });
  const [hasCert, setHasCert] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, urlsRes] = await Promise.all([
        authenticatedFetch('/api/sso/config'),
        authenticatedFetch('/api/sso/config/metadata-url')
      ]);
      if (configRes.status === 401) return handleUnauthorized();
      const configData = await configRes.json();
      if (configRes.status === 403 && configData.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (configData.success && configData.data) {
        setForm((f) => ({ ...f, ...configData.data, idpCert: '' }));
        setHasCert(!!configData.data.hasCert);
      }
      const urlsData = await urlsRes.json();
      if (urlsData.success) setUrls(urlsData);
    } catch (err) {
      toast?.error?.('Failed to load SSO settings');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.entryPoint || (!form.idpCert && !hasCert)) {
      toast?.error?.('IdP SSO URL and certificate are required');
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/sso/config', {
        method: 'PUT',
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to save SSO settings');
        return;
      }
      toast?.success?.('SSO settings saved');
      setHasCert(true);
      setForm((f) => ({ ...f, idpCert: '' }));
    } catch (err) {
      toast?.error?.('Failed to save SSO settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /></div>;
  }

  if (upgradeRequired) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">SSO is an Enterprise feature</h2>
          <p className="text-gray-500 mt-2 text-sm">Upgrade to Enterprise to enable SAML single sign-on for your organization.</p>
          <a href="/billing" className="inline-block mt-6 px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">View Plans</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-gray-400" /> Single Sign-On (SAML)
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Connect your identity provider (Okta, Azure AD, OneLogin, etc.) so your team can sign in with SSO.</p>
        </div>

        {urls && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Give these to your IdP admin</h3>
            <CopyField label="Entity ID / Issuer" value={urls.entityId} />
            <CopyField label="ACS (Reply) URL" value={urls.acsUrl} />
            <CopyField label="SP Metadata URL" value={urls.metadataUrl} />
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Identity Provider details</h3>

          <div>
            <label className="text-sm font-medium text-gray-700">IdP SSO URL (entryPoint)</label>
            <input
              value={form.entryPoint}
              onChange={(e) => setForm((f) => ({ ...f, entryPoint: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="https://your-idp.example.com/sso/saml"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">IdP Issuer (optional)</label>
            <input
              value={form.idpIssuer}
              onChange={(e) => setForm((f) => ({ ...f, idpIssuer: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              IdP x509 Certificate {hasCert && <span className="text-green-600 text-xs font-normal">(already configured — leave blank to keep)</span>}
            </label>
            <textarea
              value={form.idpCert}
              onChange={(e) => setForm((f) => ({ ...f, idpCert: e.target.value }))}
              rows={5}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono"
              placeholder={hasCert ? '••••••••••••••••••••' : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Email attribute name</label>
              <input
                value={form.attributeMap.email}
                onChange={(e) => setForm((f) => ({ ...f, attributeMap: { ...f.attributeMap, email: e.target.value } }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Name attribute name</label>
              <input
                value={form.attributeMap.name}
                onChange={(e) => setForm((f) => ({ ...f, attributeMap: { ...f.attributeMap, name: e.target.value } }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Default role for new SSO users</label>
            <select
              value={form.defaultRole}
              onChange={(e) => setForm((f) => ({ ...f, defaultRole: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="recruiter">Recruiter</option>
              <option value="interviewer">Interviewer</option>
              <option value="readonly">Read-only</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.jitProvisioning} onChange={(e) => setForm((f) => ({ ...f, jitProvisioning: e.target.checked }))} className="rounded border-gray-300" />
            Automatically create accounts for new SSO users (just-in-time provisioning)
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} className="rounded border-gray-300" />
            Enable SSO for this organization
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save SSO Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SSOSettingsPage;
