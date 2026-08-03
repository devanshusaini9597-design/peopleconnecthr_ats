import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Lock, Loader2, Save, Smartphone, Clock, Globe, Server, Copy, Check
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import API_URL from '../config';

const ToggleRow = ({ checked, onChange, disabled, label, description }) => (
  <label className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-colors ${
    disabled
      ? 'opacity-50 cursor-not-allowed border-stone-100 bg-stone-50/40'
      : 'cursor-pointer border-stone-100 bg-stone-50/50 hover:bg-brand-50/30 hover:border-brand-100'
  }`}>
    <div className="min-w-0">
      <span className="text-sm font-semibold text-stone-900">{label}</span>
      {description && <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{description}</p>}
    </div>
    <div className="relative inline-flex items-center shrink-0">
      <input type="checkbox" className="sr-only peer" checked={checked} disabled={disabled} onChange={onChange} />
      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600 peer-disabled:opacity-60" />
    </div>
  </label>
);

const UpgradeStrip = ({ message }) => (
  <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-amber-200/80 bg-amber-50/40 text-xs text-amber-900">
    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
    <span className="flex-1 min-w-0">{message}</span>
    <a href="/billing" className="font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">View Plans</a>
  </div>
);

const SecuritySettingsPage = () => {
  const toast = useToast();
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const onCollapse = (e) => setSidebarCollapsed(!!e.detail);
    window.addEventListener('sidebarCollapsed', onCollapse);
    return () => window.removeEventListener('sidebarCollapsed', onCollapse);
  }, []);

  // MFA enrollment
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const enrollmentToken = sessionStorage.getItem('mfaEnrollmentToken');

  const authHeaders = (extra = {}) => {
    const token = enrollmentToken || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...extra
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/api/mfa/status`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/security/settings`, { headers: authHeaders() })
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
    } catch (err) {
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
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to start MFA setup');
        return;
      }
      setSetupData(data.data);
    } catch (err) {
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
      if (data.token) {
        localStorage.setItem('token', data.token);
        sessionStorage.removeItem('mfaEnrollmentToken');
        if (data.user) localStorage.setItem('userData', JSON.stringify(data.user));
        if (data.organization) localStorage.setItem('orgData', JSON.stringify(data.organization));
        toast?.success?.('MFA enabled — you are now signed in.');
      } else {
        toast?.success?.('MFA enabled successfully');
      }
    } catch (err) {
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
    } catch (err) {
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

  const removeIp = (ip) => {
    setSettings((s) => ({ ...s, ipAllowlist: s.ipAllowlist.filter((x) => x !== ip) }));
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
      <div className="page-shell-ats animate-page-enter pb-28">
        <div className="h-7 w-56 skeleton-ats rounded-lg" />
        <div className="card-ats-bordered p-6 mt-4 space-y-4">
          <div className="h-11 w-full skeleton-ats rounded-xl" />
          <div className="h-11 w-full skeleton-ats rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter pb-32 sm:pb-28">
      <PageHeader
        icon={Shield}
        title="Security"
        subtitle="Multi-factor authentication, session policies, and network controls."
        gradientTitle
      />

      {/* Personal MFA */}
      <div className="card-ats-bordered p-5 sm:p-6 space-y-4 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <h3 className="section-title-ats !mb-0 !pb-0 !border-0">
          <Smartphone className="w-4 h-4 text-brand-600" />
          Your authenticator (MFA)
        </h3>

        {mfaStatus.mfaEnabled ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            MFA is enabled. {mfaStatus.backupCodesRemaining} backup codes remaining.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              Protect your account with a time-based one-time password (TOTP) from Google Authenticator, Authy, or similar.
            </p>
            {!setupData ? (
              <button type="button" onClick={startMfaSetup} disabled={enrolling} className="btn-primary w-full sm:w-auto">
                {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set up MFA'}
              </button>
            ) : (
              <div className="space-y-3 border border-stone-100 rounded-xl p-4 bg-stone-50/50">
                <p className="text-sm text-stone-600">Scan this secret in your authenticator app, or enter it manually:</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs font-mono bg-white border border-stone-200 rounded-lg px-3 py-2 break-all">
                    {setupData.secret}
                  </code>
                  <button type="button" onClick={copySecret} className="btn-secondary !px-3" aria-label="Copy secret">
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {setupData.otpauthUrl && (
                  <p className="text-xs text-stone-500 break-all">{setupData.otpauthUrl}</p>
                )}
                <div>
                  <label className="label-ats">Verification code</label>
                  <input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input-ats max-w-xs font-mono tracking-widest"
                    placeholder="000000"
                    inputMode="numeric"
                  />
                </div>
                <button type="button" onClick={confirmMfaSetup} disabled={enrolling} className="btn-primary w-full sm:w-auto">
                  {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & enable'}
                </button>
              </div>
            )}
          </div>
        )}

        {backupCodes?.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-900">Save these backup codes — shown once:</p>
            <div className="grid grid-cols-2 gap-1 font-mono text-xs">
              {backupCodes.map((c) => <span key={c}>{c}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* Org policies */}
      <div className="card-ats-bordered p-5 sm:p-6 space-y-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-60" />
        <h3 className="section-title-ats !mb-0 !pb-0 !border-0">
          <Lock className="w-4 h-4 text-brand-600" />
          Organization policies
        </h3>

        {!entitlements.mfaEnforcement && (
          <UpgradeStrip message="MFA enforcement requires Professional or higher." />
        )}

        <ToggleRow
          checked={settings.mfaEnforced}
          disabled={!entitlements.mfaEnforcement}
          onChange={(e) => setSettings((s) => ({ ...s, mfaEnforced: e.target.checked }))}
          label="Require MFA for all users"
          description={entitlements.mfaEnforcement ? 'Users must enroll MFA before accessing the app (Professional+).' : 'Upgrade to Professional to enforce MFA.'}
        />

        {!entitlements.sessionPolicy && (
          <UpgradeStrip message="Session policies require Professional or higher." />
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!entitlements.sessionPolicy ? 'opacity-50' : ''}`}>
          <div>
            <label className="label-ats flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Session idle timeout (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={10080}
              disabled={!entitlements.sessionPolicy}
              value={settings.sessionIdleMinutes}
              onChange={(e) => setSettings((s) => ({ ...s, sessionIdleMinutes: parseInt(e.target.value, 10) || 480 }))}
              className="input-ats"
            />
          </div>
          <div>
            <label className="label-ats">Max concurrent sessions</label>
            <input
              type="number"
              min={1}
              max={50}
              disabled={!entitlements.sessionPolicy}
              value={settings.maxConcurrentSessions}
              onChange={(e) => setSettings((s) => ({ ...s, maxConcurrentSessions: parseInt(e.target.value, 10) || 10 }))}
              className="input-ats"
            />
          </div>
        </div>

        {!entitlements.ipAllowlist && (
          <UpgradeStrip message="IP allowlist requires Enterprise." />
        )}

        <div className={!entitlements.ipAllowlist ? 'opacity-50' : ''}>
          <label className="label-ats flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> IP allowlist (Enterprise)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              disabled={!entitlements.ipAllowlist}
              className="input-ats flex-1 font-mono text-sm"
              placeholder="203.0.113.10 or 10.0.0.0/8"
            />
            <button type="button" onClick={addIp} disabled={!entitlements.ipAllowlist} className="btn-secondary w-full sm:w-auto shrink-0">Add</button>
          </div>
          {settings.ipAllowlist.length > 0 && (
            <ul className="space-y-1">
              {settings.ipAllowlist.map((ip) => (
                <li key={ip} className="flex items-center justify-between text-sm font-mono bg-stone-50 rounded-lg px-3 py-2">
                  {ip}
                  <button type="button" onClick={() => removeIp(ip)} className="btn-ghost !text-red-600 hover:!bg-red-50 text-xs font-semibold shrink-0">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-100 bg-stone-50/50">
          <Server className="w-5 h-5 text-stone-400" />
          <div>
            <p className="text-sm font-semibold text-stone-900">Deployment tier</p>
            <p className="text-xs text-stone-500 capitalize">
              {deploymentTier}
              {entitlements.dedicated && deploymentTier === 'dedicated' ? ' — dedicated infrastructure' : ''}
            </p>
          </div>
        </div>
      </div>

      <div
        className={`fixed bottom-0 right-0 z-40 left-0 ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-[280px]'}`}
      >
        <div className="border-t border-stone-200/80 bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.08)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
            <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
              <button type="button" onClick={saveOrgSettings} disabled={saving} className="btn-primary w-full sm:w-auto">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save policies</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettingsPage;
