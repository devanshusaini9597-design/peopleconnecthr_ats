import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Lock, Loader2, Save, Copy, Check, Shield, Link2, UserCog } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import PremiumSelect from './ui/PremiumSelect';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const ROLE_OPTIONS = [
  { value: 'recruiter', label: 'Recruiter', description: 'Hiring workflows', icon: UserCog },
  { value: 'interviewer', label: 'Interviewer', description: 'Interview access', icon: UserCog },
  { value: 'readonly', label: 'Read-only', description: 'View only', icon: Shield },
  { value: 'admin', label: 'Admin', description: 'Full org access', icon: Shield },
];

const CopyField = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="min-w-0">
      <label className="label-ats">{label}</label>
      <div className="flex items-stretch gap-2">
        <input readOnly value={value || ''} className="flex-1 input-ats !text-xs text-stone-600 font-mono min-w-0" />
        <button type="button" onClick={copy} className="btn-secondary !px-3 shrink-0" title="Copy" aria-label={`Copy ${label}`}>
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

const ToggleRow = ({ checked, onChange, label, description }) => (
  <label className="flex items-center justify-between gap-4 cursor-pointer p-3.5 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-brand-50/30 hover:border-brand-100 transition-colors">
    <div className="min-w-0">
      <span className="text-sm font-semibold text-stone-900">{label}</span>
      {description && <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{description}</p>}
    </div>
    <div className="relative inline-flex items-center shrink-0">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
    </div>
  </label>
);

const SSOSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [urls, setUrls] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [form, setForm] = useState({
    protocol: 'saml',
    enabled: false,
    entryPoint: '',
    idpIssuer: '',
    idpCert: '',
    wantAssertionsSigned: true,
    defaultRole: 'recruiter',
    jitProvisioning: true,
    attributeMap: { email: 'email', name: 'name' },
    oidc: {
      clientId: '',
      clientSecret: '',
      issuer: '',
      authorizationURL: '',
      tokenURL: '',
      userInfoURL: '',
      redirectUri: ''
    }
  });
  const [hasCert, setHasCert] = useState(false);
  const [hasOidcSecret, setHasOidcSecret] = useState(false);
  const [scimInfo, setScimInfo] = useState(null);

  useEffect(() => {
    const onCollapse = (e) => setSidebarCollapsed(!!e.detail);
    window.addEventListener('sidebarCollapsed', onCollapse);
    return () => window.removeEventListener('sidebarCollapsed', onCollapse);
  }, []);

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
        setForm((f) => ({
          ...f,
          ...configData.data,
          idpCert: '',
          oidc: { ...f.oidc, ...(configData.data.oidc || {}), clientSecret: '' }
        }));
        setHasCert(!!configData.data.hasCert);
        setHasOidcSecret(!!configData.data.hasOidcSecret);
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
    if (form.protocol === 'saml' && (!form.entryPoint || (!form.idpCert && !hasCert))) {
      toast?.error?.('IdP SSO URL and certificate are required for SAML');
      return;
    }
    if (form.protocol === 'oidc' && (!form.oidc?.clientId || (!form.oidc?.clientSecret && !hasOidcSecret))) {
      toast?.error?.('OIDC client ID and secret are required');
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
      setHasOidcSecret(!!form.oidc?.clientSecret || hasOidcSecret);
      setForm((f) => ({ ...f, idpCert: '', oidc: { ...f.oidc, clientSecret: '' } }));
    } catch (err) {
      toast?.error?.('Failed to save SSO settings');
    } finally {
      setSaving(false);
    }
  };

  const issueScimToken = async () => {
    try {
      const res = await authenticatedFetch('/api/sso/scim-token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to issue SCIM token');
        return;
      }
      setScimInfo(data.data);
      toast?.success?.('SCIM token issued — copy it now');
    } catch (err) {
      toast?.error?.('Failed to issue SCIM token');
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter pb-28">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-56 skeleton-ats rounded-lg" />
            <div className="h-4 w-80 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="card-ats-bordered p-6 space-y-4 mt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-28 skeleton-ats rounded" />
              <div className="h-11 w-full skeleton-ats rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
              <Lock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">SSO is an Enterprise feature</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Upgrade to Enterprise to enable SAML single sign-on for your organization.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter pb-32 sm:pb-28">
      <PageHeader
        icon={KeyRound}
        title="Single Sign-On"
        subtitle="Connect Okta, Azure AD, or any SAML or OIDC identity provider."
        gradientTitle
      >
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
          form.enabled
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-stone-100 text-stone-500 border-stone-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${form.enabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
          {form.enabled ? 'SSO Enabled' : 'SSO Disabled'}
        </span>
      </PageHeader>

      {urls && (
        <div className="card-ats-bordered p-5 sm:p-6 space-y-4 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h3 className="section-title-ats !mb-0 !pb-0 !border-0">
            <Link2 className="w-4 h-4 text-brand-600" />
            Service provider details
          </h3>
          <p className="text-sm text-stone-500 -mt-1">Give these URLs to your IdP admin when creating the SAML app.</p>
          <div className="space-y-3.5 pt-1">
            <CopyField label="Entity ID / Issuer" value={urls.entityId} />
            <CopyField label="ACS (Reply) URL" value={urls.acsUrl} />
            <CopyField label="SP Metadata URL" value={urls.metadataUrl} />
          </div>
        </div>
      )}

      <div className="card-ats-bordered p-5 sm:p-6 space-y-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-60" />
        <h3 className="section-title-ats !mb-0 !pb-0 !border-0">
          <KeyRound className="w-4 h-4 text-brand-600" />
          Identity provider
        </h3>

        <div className="space-y-4 pt-1">
          <div>
            <label className="label-ats">Protocol</label>
            <select
              value={form.protocol}
              onChange={(e) => setForm((f) => ({ ...f, protocol: e.target.value }))}
              className="input-ats"
            >
              <option value="saml">SAML 2.0</option>
              <option value="oidc">OpenID Connect (OIDC)</option>
            </select>
          </div>

          {form.protocol === 'saml' ? (
          <>
          <div>
            <label className="label-ats">IdP SSO URL</label>
            <input
              value={form.entryPoint}
              onChange={(e) => setForm((f) => ({ ...f, entryPoint: e.target.value }))}
              className="input-ats"
              placeholder="https://your-idp.example.com/sso/saml"
            />
          </div>

          <div>
            <label className="label-ats">IdP Issuer (optional)</label>
            <input
              value={form.idpIssuer}
              onChange={(e) => setForm((f) => ({ ...f, idpIssuer: e.target.value }))}
              className="input-ats"
              placeholder="Optional issuer / entity ID from IdP"
            />
          </div>

          <div>
            <label className="label-ats">
              IdP x509 Certificate{' '}
              {hasCert && <span className="text-emerald-600 text-xs font-semibold normal-case tracking-normal">(configured — leave blank to keep)</span>}
            </label>
            <textarea
              value={form.idpCert}
              onChange={(e) => setForm((f) => ({ ...f, idpCert: e.target.value }))}
              rows={4}
              className="textarea-ats !text-xs font-mono"
              placeholder={hasCert ? '••••••••••••••••••••' : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
            />
          </div>
          </>
          ) : (
          <>
            <div>
              <label className="label-ats">Client ID</label>
              <input value={form.oidc.clientId} onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, clientId: e.target.value } }))} className="input-ats" />
            </div>
            <div>
              <label className="label-ats">
                Client Secret {hasOidcSecret && <span className="text-emerald-600 text-xs font-semibold">(configured)</span>}
              </label>
              <input type="password" value={form.oidc.clientSecret} onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, clientSecret: e.target.value } }))} className="input-ats" placeholder={hasOidcSecret ? '••••••••' : ''} />
            </div>
            <div>
              <label className="label-ats">Issuer</label>
              <input value={form.oidc.issuer} onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, issuer: e.target.value } }))} className="input-ats" />
            </div>
            <div>
              <label className="label-ats">Authorization URL</label>
              <input value={form.oidc.authorizationURL} onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, authorizationURL: e.target.value } }))} className="input-ats" />
            </div>
            <div>
              <label className="label-ats">Token URL</label>
              <input value={form.oidc.tokenURL} onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, tokenURL: e.target.value } }))} className="input-ats" />
            </div>
            <div>
              <label className="label-ats">UserInfo URL</label>
              <input value={form.oidc.userInfoURL} onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, userInfoURL: e.target.value } }))} className="input-ats" />
            </div>
            <div>
              <label className="label-ats">Redirect URI (optional)</label>
              <input value={form.oidc.redirectUri} onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, redirectUri: e.target.value } }))} className="input-ats" placeholder={urls?.oidcCallbackUrl || ''} />
            </div>
            {urls?.oidcCallbackUrl && <CopyField label="OIDC Callback URL" value={urls.oidcCallbackUrl} />}
          </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Email attribute</label>
              <input
                value={form.attributeMap.email}
                onChange={(e) => setForm((f) => ({ ...f, attributeMap: { ...f.attributeMap, email: e.target.value } }))}
                className="input-ats"
              />
            </div>
            <div>
              <label className="label-ats">Name attribute</label>
              <input
                value={form.attributeMap.name}
                onChange={(e) => setForm((f) => ({ ...f, attributeMap: { ...f.attributeMap, name: e.target.value } }))}
                className="input-ats"
              />
            </div>
          </div>

          <div>
            <label className="label-ats">Default role for new SSO users</label>
            <PremiumSelect
              value={form.defaultRole}
              onChange={(v) => setForm((f) => ({ ...f, defaultRole: v || 'recruiter' }))}
              options={ROLE_OPTIONS}
              placeholder="Select role"
              icon={UserCog}
            />
          </div>

          <div className="space-y-2.5 pt-2 border-t border-stone-100">
            <ToggleRow
              checked={form.jitProvisioning}
              onChange={(e) => setForm((f) => ({ ...f, jitProvisioning: e.target.checked }))}
              label="Just-in-time provisioning"
              description="Automatically create accounts for new SSO users"
            />
            <ToggleRow
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              label="Enable SSO"
              description="Allow team members to sign in with your identity provider"
            />
          </div>
        </div>
      </div>

      <div className="card-ats-bordered p-5 sm:p-6 space-y-4 relative overflow-hidden">
        <h3 className="section-title-ats !mb-0 !pb-0 !border-0">SCIM 2.0 provisioning</h3>
        <p className="text-sm text-stone-500">Issue a bearer token for your IdP to provision users via SCIM.</p>
        <button type="button" onClick={issueScimToken} className="btn-secondary">Issue SCIM token</button>
        {scimInfo && (
          <div className="space-y-2">
            <CopyField label="SCIM Base URL" value={scimInfo.scimBaseUrl} />
            <CopyField label="Bearer token (shown once)" value={scimInfo.scimToken} />
          </div>
        )}
      </div>

      <div
        className={`fixed bottom-0 right-0 z-40 left-0 ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-[280px]'}`}
      >
        <div className="border-t border-stone-200/80 bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.08)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-2">
              <button type="button" onClick={load} disabled={saving || loading} className="btn-secondary !px-3 !py-2.5 !text-sm min-w-0">
                Reset
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary !px-3 !py-2.5 !text-sm min-w-0">
                {saving ? (
                  <><Loader2 size={16} className="animate-spin flex-shrink-0" /> <span className="truncate">Saving…</span></>
                ) : (
                  <><Save className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Save SSO</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SSOSettingsPage;
