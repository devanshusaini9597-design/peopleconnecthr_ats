import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Loader2, Save, RefreshCw } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import API_URL from '../config';
import {
  SEC_TOUR_KEY, SEC_TOUR_STEPS, IDLE_OPTIONS, SESSION_COUNT_OPTIONS,
} from './securitySettings/securityConstants';
import MfaSection from './securitySettings/MfaSection';
import OrgPoliciesSection from './securitySettings/OrgPoliciesSection';

export default function SecuritySettingsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(SEC_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mfaStatus, setMfaStatus] = useState({ mfaEnabled: false, backupCodesRemaining: 0 });
  const [settings, setSettings] = useState({
    mfaEnforced: false,
    sessionIdleMinutes: 480,
    maxConcurrentSessions: 10,
    ipAllowlist: []
  });
  const [entitlements, setEntitlements] = useState({});
  const [deploymentTier, setDeploymentTier] = useState('shared');
  const [ipInput, setIpInput] = useState('');
  const [ipRemoveTarget, setIpRemoveTarget] = useState(null);

  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const enrollmentToken = sessionStorage.getItem('mfaEnrollmentToken');

  const authHeaders = (extra = {}) => {
    return {
      'Content-Type': 'application/json',
      ...extra
    };
  };

  const idleValue = useMemo(() => {
    const n = String(settings.sessionIdleMinutes);
    if (IDLE_OPTIONS.some((o) => o.value === n)) return n;
    return n;
  }, [settings.sessionIdleMinutes]);

  const idleOptions = useMemo(() => {
    const n = String(settings.sessionIdleMinutes);
    if (IDLE_OPTIONS.some((o) => o.value === n)) return IDLE_OPTIONS;
    return [
      ...IDLE_OPTIONS,
      { value: n, label: `${n} minutes`, description: 'Custom' },
    ];
  }, [settings.sessionIdleMinutes]);

  const sessionCountValue = useMemo(() => {
    const n = String(settings.maxConcurrentSessions);
    return n;
  }, [settings.maxConcurrentSessions]);

  const sessionCountOptions = useMemo(() => {
    const n = String(settings.maxConcurrentSessions);
    if (SESSION_COUNT_OPTIONS.some((o) => o.value === n)) return SESSION_COUNT_OPTIONS;
    return [
      ...SESSION_COUNT_OPTIONS,
      { value: n, label: n, description: 'Custom' },
    ];
  }, [settings.maxConcurrentSessions]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/api/mfa/status`, { headers: authHeaders(), credentials: 'include' }),
        fetch(`${API_URL}/api/security/settings`, { headers: authHeaders(), credentials: 'include' })
      ]);

      if (statusRes.status === 401 || settingsRes.status === 401) return handleUnauthorized();

      const statusData = await statusRes.json();
      if (statusData.success) setMfaStatus(statusData.data);

      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        const s = settingsData.data.securitySettings || {};
        setSettings({
          mfaEnforced: !!s.mfaEnforced,
          sessionIdleMinutes: s.sessionIdleMinutes ?? 480,
          maxConcurrentSessions: s.maxConcurrentSessions ?? 10,
          ipAllowlist: s.ipAllowlist || []
        });
        setEntitlements(settingsData.data.entitlements || {});
        setDeploymentTier(settingsData.data.deploymentTier || 'shared');
      }
    } catch {
      toast?.error?.('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const startMfaSetup = async () => {
    setEnrolling(true);
    try {
      const res = await fetch(`${API_URL}/api/mfa/setup`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to start MFA setup');
        return;
      }
      setSetupData(data.data);
    } catch {
      toast?.error?.('Failed to start MFA setup');
    } finally {
      setEnrolling(false);
    }
  };

  const confirmMfaSetup = async () => {
    if (!verifyCode) {
      toast?.error?.('Enter the 6-digit code from your authenticator app');
      return;
    }
    setEnrolling(true);
    try {
      const res = await fetch(`${API_URL}/api/mfa/verify-setup`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ code: verifyCode })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Invalid code');
        return;
      }
      setBackupCodes(data.backupCodes || []);
      setMfaStatus({ mfaEnabled: true, backupCodesRemaining: data.backupCodes?.length || 0 });
      setSetupData(null);
      setVerifyCode('');
      localStorage.removeItem('token');
      sessionStorage.removeItem('mfaEnrollmentToken');
      if (data.user) localStorage.setItem('userData', JSON.stringify(data.user));
      if (data.organization) localStorage.setItem('orgData', JSON.stringify(data.organization));
      toast?.success?.('MFA enabled successfully');
    } catch {
      toast?.error?.('Failed to verify MFA');
    } finally {
      setEnrolling(false);
    }
  };

  const saveOrgSettings = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/security/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to save settings');
        return;
      }
      toast?.success?.('Security settings saved');
    } catch {
      toast?.error?.('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addIp = () => {
    const ip = ipInput.trim();
    if (!ip) return;
    if (settings.ipAllowlist.includes(ip)) {
      toast?.error?.('IP already in allowlist');
      return;
    }
    setSettings((s) => ({ ...s, ipAllowlist: [...s.ipAllowlist, ip] }));
    setIpInput('');
  };

  const confirmRemoveIp = () => {
    if (!ipRemoveTarget) return;
    setSettings((s) => ({
      ...s,
      ipAllowlist: s.ipAllowlist.filter((x) => x !== ipRemoveTarget)
    }));
    setIpRemoveTarget(null);
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard?.writeText(setupData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 1500);
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="h-7 w-56 skeleton-ats rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
          <div className="lg:col-span-5 h-64 skeleton-ats rounded-2xl" />
          <div className="lg:col-span-7 h-80 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Shield}
        title={t('pages.security.title')}
        subtitle="Multi-factor authentication, session policies, and network controls."
        gradientTitle
      >
        <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <button
          data-tour="sec-save"
          type="button"
          onClick={saveOrgSettings}
          disabled={saving}
          className="btn-primary w-full sm:w-auto"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save policies
        </button>
      </PageHeader>

      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
        Secure your own login with MFA, then set organization-wide policies.
        Press <span className="font-semibold text-stone-800">?</span> bottom-right for a tour.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <MfaSection
          mfaStatus={mfaStatus}
          setupData={setupData}
          verifyCode={verifyCode}
          setVerifyCode={setVerifyCode}
          backupCodes={backupCodes}
          enrolling={enrolling}
          copiedSecret={copiedSecret}
          onStartSetup={startMfaSetup}
          onConfirmSetup={confirmMfaSetup}
          onCopySecret={copySecret}
        />
        <OrgPoliciesSection
          settings={settings}
          setSettings={setSettings}
          entitlements={entitlements}
          deploymentTier={deploymentTier}
          idleValue={idleValue}
          idleOptions={idleOptions}
          sessionCountValue={sessionCountValue}
          sessionCountOptions={sessionCountOptions}
          ipInput={ipInput}
          setIpInput={setIpInput}
          onAddIp={addIp}
          onRemoveIp={setIpRemoveTarget}
        />
      </div>

      <ConfirmationModal
        isOpen={!!ipRemoveTarget}
        onClose={() => setIpRemoveTarget(null)}
        onConfirm={confirmRemoveIp}
        title="Remove IP from allowlist?"
        message={`Remove “${ipRemoveTarget}” from the organization IP allowlist?`}
        confirmText="Remove IP"
        type="delete"
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Security" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={SEC_TOUR_STEPS}
        storageKey={SEC_TOUR_KEY}
      />
    </div>
  );
}
