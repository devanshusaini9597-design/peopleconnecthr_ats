import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Lock, Info } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import {
  SSO_TOUR_KEY,
  SSO_TOUR_STEPS,
  emptySsoForm,
} from './ssoSettings/ssoSettingsConstants';
import {
  SsoExplainerCards,
  SsoSpSection,
  SsoIdpSection,
  SsoScimSection,
  SsoSaveBar,
} from './ssoSettings/SsoConfigPanels';

const SSOSettingsPage = () => {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(SSO_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [urls, setUrls] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [form, setForm] = useState(emptySsoForm);
  const [hasCert, setHasCert] = useState(false);
  const [hasOidcSecret, setHasOidcSecret] = useState(false);
  const [scimInfo, setScimInfo] = useState(null);
  const [issuingScim, setIssuingScim] = useState(false);

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
        authenticatedFetch('/api/sso/config/metadata-url'),
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
          oidc: { ...f.oidc, ...(configData.data.oidc || {}), clientSecret: '' },
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
        body: JSON.stringify(form),
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
    setIssuingScim(true);
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
    } finally {
      setIssuingScim(false);
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
              Upgrade to Enterprise to enable SAML / OIDC single sign-on for your organization.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats has-sticky-footer animate-page-enter">
      <PageHeader
        icon={KeyRound}
        title="Single Sign-On"
        subtitle="Let your team sign in with your company identity provider."
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

      <div
        data-tour="sso-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          SSO means employees use one company login (Okta / Azure AD / Google) instead of a separate ATS password.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      <SsoExplainerCards />

      <SsoSpSection urls={urls} />

      <SsoIdpSection
        form={form}
        setForm={setForm}
        hasCert={hasCert}
        hasOidcSecret={hasOidcSecret}
        urls={urls}
      />

      <SsoScimSection
        issuingScim={issuingScim}
        issueScimToken={issueScimToken}
        scimInfo={scimInfo}
      />

      {/* Spacer so sticky save bar never covers SCIM / last fields */}
      <div className="h-4" aria-hidden />

      <SsoSaveBar
        sidebarCollapsed={sidebarCollapsed}
        load={load}
        handleSave={handleSave}
        saving={saving}
        loading={loading}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of SSO" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={SSO_TOUR_STEPS}
        storageKey={SSO_TOUR_KEY}
      />
    </div>
  );
};

export default SSOSettingsPage;
