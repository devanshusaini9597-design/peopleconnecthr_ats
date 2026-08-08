import React from 'react';
import {
  KeyRound, Loader2, Shield, Link2, UserCog, Building2, Users, Save,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { PROTOCOL_OPTIONS, ROLE_OPTIONS } from './ssoSettingsConstants';
import { CopyField, ToggleRow, SectionCard } from './SsoFormControls';

const EXPLAINER = [
  {
    icon: Building2,
    title: 'What it is',
    body: 'Trust your company IdP to prove who someone is — SkillNix never stores their corporate password.',
  },
  {
    icon: Users,
    title: 'What it’s for',
    body: 'Central access control, faster onboarding, MFA from IT, and automatic offboarding when someone leaves.',
  },
  {
    icon: Shield,
    title: 'How to set up',
    body: 'IT creates an app in the IdP, you exchange URLs/certs here, then turn Enable SSO on.',
  },
];

export function SsoExplainerCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {EXPLAINER.map((item) => (
        <div key={item.title} className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-2.5">
            <item.icon className="w-4 h-4" />
          </div>
          <p className="text-sm font-bold text-stone-900">{item.title}</p>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export function SsoSpSection({ urls }) {
  if (!urls) return null;
  return (
    <SectionCard
      tourId="sso-sp"
      icon={Link2}
      title="Service provider details"
      description="Give these URLs to your IdP admin when creating the SAML / OIDC app."
    >
      <div className="space-y-3.5">
        <CopyField label="Entity ID / Issuer" value={urls.entityId} />
        <CopyField label="ACS (Reply) URL" value={urls.acsUrl} />
        <CopyField label="SP Metadata URL" value={urls.metadataUrl} />
        {urls?.oidcCallbackUrl && (
          <CopyField label="OIDC Callback URL" value={urls.oidcCallbackUrl} />
        )}
      </div>
    </SectionCard>
  );
}

export function SsoIdpSection({ form, setForm, hasCert, hasOidcSecret, urls }) {
  return (
    <SectionCard
      tourId="sso-idp"
      icon={KeyRound}
      title="Identity provider"
      description="Paste connection details from Okta, Azure AD, Google Workspace, or another IdP."
    >
      <div>
        <label className="label-ats">Protocol</label>
        <PremiumSelect
          value={form.protocol}
          onChange={(v) => setForm((f) => ({ ...f, protocol: v || 'saml' }))}
          options={PROTOCOL_OPTIONS}
          variant="list"
        />
      </div>

      {form.protocol === 'saml' ? (
        <div className="space-y-4">
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
              {hasCert && (
                <span className="text-emerald-600 text-xs font-semibold normal-case tracking-normal">
                  (configured — leave blank to keep)
                </span>
              )}
            </label>
            <textarea
              value={form.idpCert}
              onChange={(e) => setForm((f) => ({ ...f, idpCert: e.target.value }))}
              rows={4}
              className="textarea-ats !text-xs font-mono"
              placeholder={hasCert ? '••••••••••••••••••••' : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
            />
          </div>
          <ToggleRow
            checked={form.wantAssertionsSigned}
            onChange={(e) => setForm((f) => ({ ...f, wantAssertionsSigned: e.target.checked }))}
            label="Require signed assertions"
            description="Reject SAML responses that are not signed by the IdP"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Client ID</label>
              <input
                value={form.oidc.clientId}
                onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, clientId: e.target.value } }))}
                className="input-ats"
              />
            </div>
            <div>
              <label className="label-ats">
                Client Secret{' '}
                {hasOidcSecret && (
                  <span className="text-emerald-600 text-xs font-semibold">(configured)</span>
                )}
              </label>
              <input
                type="password"
                value={form.oidc.clientSecret}
                onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, clientSecret: e.target.value } }))}
                className="input-ats"
                placeholder={hasOidcSecret ? '••••••••' : ''}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <label className="label-ats">Issuer</label>
            <input
              value={form.oidc.issuer}
              onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, issuer: e.target.value } }))}
              className="input-ats"
              placeholder="https://accounts.google.com or https://login.microsoftonline.com/…"
            />
          </div>
          <div>
            <label className="label-ats">Authorization URL</label>
            <input
              value={form.oidc.authorizationURL}
              onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, authorizationURL: e.target.value } }))}
              className="input-ats"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Token URL</label>
              <input
                value={form.oidc.tokenURL}
                onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, tokenURL: e.target.value } }))}
                className="input-ats"
              />
            </div>
            <div>
              <label className="label-ats">UserInfo URL</label>
              <input
                value={form.oidc.userInfoURL}
                onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, userInfoURL: e.target.value } }))}
                className="input-ats"
              />
            </div>
          </div>
          <div>
            <label className="label-ats">Redirect URI (optional)</label>
            <input
              value={form.oidc.redirectUri}
              onChange={(e) => setForm((f) => ({ ...f, oidc: { ...f.oidc, redirectUri: e.target.value } }))}
              className="input-ats"
              placeholder={urls?.oidcCallbackUrl || ''}
            />
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-stone-100 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">User mapping</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-ats">Email attribute</label>
            <input
              value={form.attributeMap.email}
              onChange={(e) => setForm((f) => ({
                ...f,
                attributeMap: { ...f.attributeMap, email: e.target.value },
              }))}
              className="input-ats"
              placeholder="email"
            />
          </div>
          <div>
            <label className="label-ats">Name attribute</label>
            <input
              value={form.attributeMap.name}
              onChange={(e) => setForm((f) => ({
                ...f,
                attributeMap: { ...f.attributeMap, name: e.target.value },
              }))}
              className="input-ats"
              placeholder="name"
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
            variant="list"
          />
        </div>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-stone-100">
        <ToggleRow
          checked={form.jitProvisioning}
          onChange={(e) => setForm((f) => ({ ...f, jitProvisioning: e.target.checked }))}
          label="Just-in-time provisioning"
          description="Automatically create accounts the first time a user signs in via SSO"
        />
        <ToggleRow
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          label="Enable SSO"
          description="Allow team members to sign in with your identity provider"
        />
      </div>
    </SectionCard>
  );
}

export function SsoScimSection({ issuingScim, issueScimToken, scimInfo }) {
  return (
    <SectionCard
      icon={UserCog}
      title="SCIM 2.0 provisioning"
      description="Let your IdP create, update, and deactivate users automatically (enterprise directory sync)."
    >
      <button
        type="button"
        onClick={issueScimToken}
        disabled={issuingScim}
        className="btn-secondary"
      >
        {issuingScim ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {issuingScim ? 'Issuing…' : 'Issue SCIM token'}
      </button>
      {scimInfo && (
        <div className="space-y-3 pt-1">
          <CopyField label="SCIM Base URL" value={scimInfo.scimBaseUrl} />
          <CopyField label="Bearer token (shown once)" value={scimInfo.scimToken} />
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Copy the bearer token now — it won’t be shown again after you leave this page.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

export function SsoSaveBar({ sidebarCollapsed, load, handleSave, saving, loading }) {
  return (
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
  );
}
