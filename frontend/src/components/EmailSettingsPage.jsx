import React, { useState, useEffect } from 'react';
import {
  Mail, Save, Eye, EyeOff, CheckCircle2, AlertCircle,
  Trash2, Loader2, Server, Zap, Send, Pencil, Building2
} from 'lucide-react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';

import API_URL from '../config';
const BASE = API_URL;

/** Matches backend serviceProviders + hostProviders in emailSettingsRoutes / emailService */
const SMTP_PRESETS = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 587, hint: 'Use an App Password', group: 'popular' },
  { id: 'outlook', label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, hint: 'Work or school email', group: 'popular' },
  { id: 'zoho', label: 'Zoho Mail', host: 'smtp.zoho.com', port: 587, hint: 'Zoho mailbox', group: 'popular' },
  { id: 'yahoo', label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: 587, hint: 'App password required', group: 'popular' },
  { id: 'hostinger', label: 'Hostinger', host: 'smtp.hostinger.com', port: 587, hint: 'Domain email', group: 'hosting' },
  { id: 'godaddy', label: 'GoDaddy', host: 'smtpout.secureserver.net', port: 465, hint: 'Workspace email', group: 'hosting' },
  { id: 'namecheap', label: 'Namecheap', host: 'mail.privateemail.com', port: 587, hint: 'Private Email', group: 'hosting' },
  { id: 'custom', label: 'Custom SMTP', host: '', port: 587, hint: 'Your own server', group: 'custom' },
];

const presetById = (id) => SMTP_PRESETS.find((p) => p.id === id) || SMTP_PRESETS.find((p) => p.id === 'gmail');

const emptySmtp = {
  smtpEmail: '',
  smtpAppPassword: '',
  smtpProvider: 'gmail',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  isConfigured: false,
  hasPassword: false,
};

const EmailSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingCurrent, setTestingCurrent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [zeptoActive, setZeptoActive] = useState(false);
  const [zeptoFrom, setZeptoFrom] = useState('');
  const [campaignsActive, setCampaignsActive] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [settings, setSettings] = useState(emptySmtp);
  const [draft, setDraft] = useState(emptySmtp);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const [settingsRes, channelsRes] = await Promise.all([
        authenticatedFetch(`${BASE}/api/email-settings`),
        authenticatedFetch(`${BASE}/api/email/channels`),
      ]);
      if (isUnauthorized(settingsRes)) return handleUnauthorized();
      const data = await settingsRes.json();
      if (data.success) {
        setSettings(data.settings);
        setZeptoActive(!!data.settings.hasZohoApiKey);
        setZeptoFrom(data.settings.zohoZeptomailFromEmail || '');
      }
      try {
        const chData = await channelsRes.json();
        if (chData.success && chData.channels?.marketing) {
          setCampaignsActive(chData.channels.marketing.available);
        }
      } catch (_) { /* silent */ }
    } catch (err) {
      console.error('Fetch settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openSmtpModal = () => {
    const provider = settings.smtpProvider || 'gmail';
    const preset = presetById(provider);
    setDraft({
      ...settings,
      smtpAppPassword: '',
      smtpProvider: provider,
      smtpHost: settings.smtpHost || preset.host,
      smtpPort: settings.smtpPort || preset.port,
    });
    setShowPassword(false);
    setShowSmtpModal(true);
  };

  const selectProvider = (id) => {
    const preset = presetById(id);
    setDraft((prev) => ({
      ...prev,
      smtpProvider: id,
      smtpHost: preset.host || prev.smtpHost,
      smtpPort: preset.port || prev.smtpPort,
    }));
  };

  const handleSave = async () => {
    if (!draft.smtpEmail) return toast.error('Email address is required');
    if (!draft.smtpAppPassword && !draft.hasPassword) return toast.error('Password is required');
    if (draft.smtpProvider === 'custom' && !draft.smtpHost) {
      return toast.error('SMTP host is required for custom provider');
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'SMTP connected');
        setSettings(data.settings);
        setShowSmtpModal(false);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestDraft = async () => {
    if (!draft.smtpEmail) return toast.error('Enter your email first');
    if (!draft.smtpAppPassword && !draft.hasPassword) return toast.error('Enter your password first');
    setTesting(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch {
      toast.error('Test failed. Check your settings.');
    } finally {
      setTesting(false);
    }
  };

  const handleTestCurrentConfig = async () => {
    setTestingCurrent(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings/test-current`, { method: 'POST' });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch {
      toast.error('Test failed.');
    } finally {
      setTestingCurrent(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings`, { method: 'DELETE' });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setSettings(emptySmtp);
        setConfirmRemove(false);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Failed to remove settings');
    } finally {
      setRemoving(false);
    }
  };

  const revealPassword = async () => {
    if (!showPassword && draft.hasPassword && !draft.smtpAppPassword) {
      try {
        const res = await authenticatedFetch(`${BASE}/api/email-settings/reveal-password`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) setDraft((prev) => ({ ...prev, smtpAppPassword: data.password }));
        }
      } catch (err) {
        console.error('Reveal password error:', err);
      }
    }
    setShowPassword(!showPassword);
  };

  const isCustom = draft.smtpProvider === 'custom';
  const draftPreset = presetById(draft.smtpProvider);
  const savedPreset = presetById(settings.smtpProvider);
  const hasPersonalSmtp = settings.isConfigured && settings.hasPassword && settings.smtpEmail;
  const activeSender = zeptoActive
    ? { label: 'Zoho ZeptoMail', detail: zeptoFrom || 'Default transactional sender', ok: true }
    : hasPersonalSmtp
      ? { label: savedPreset.label, detail: settings.smtpEmail, ok: true }
      : { label: 'Not connected', detail: 'Configure SMTP so the ATS can send email.', ok: false };

  if (loading) {
    return (
      <div className="page-shell-ats max-w-2xl animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-44 skeleton-ats rounded-lg" />
            <div className="h-4 w-64 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="space-y-4 mt-2">
          <div className="h-28 skeleton-ats rounded-2xl" />
          <div className="h-24 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  const providerGroups = [
    { key: 'popular', label: 'Popular' },
    { key: 'hosting', label: 'Domain hosting' },
    { key: 'custom', label: 'Other' },
  ];

  return (
    <div className="page-shell-ats max-w-2xl animate-page-enter">
      <PageHeader
        icon={Mail}
        title="Email Settings"
        subtitle="See how outbound email is sent, then connect any SMTP provider if you need a fallback."
        gradientTitle
      />

      <div className="card-ats-bordered overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-3">Delivery status</p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                activeSender.ok
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                {activeSender.ok ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-stone-900 tracking-tight">{activeSender.label}</h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    activeSender.ok
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {activeSender.ok ? 'Active' : 'Action needed'}
                  </span>
                </div>
                <p className="text-sm text-stone-500 mt-0.5 truncate">{activeSender.detail}</p>
                {zeptoActive && hasPersonalSmtp && (
                  <p className="text-xs text-stone-400 mt-1">
                    SMTP fallback · {savedPreset.label} · {settings.smtpEmail}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestCurrentConfig}
              disabled={testingCurrent || !activeSender.ok}
              className="btn-secondary shrink-0 w-full sm:w-auto"
            >
              {testingCurrent ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {testingCurrent ? 'Sending…' : 'Send test email'}
            </button>
          </div>
        </div>
      </div>

      <div className="card-ats-bordered overflow-hidden">
        <div className="p-5 sm:p-6">
          <h3 className="text-sm font-bold text-stone-900 tracking-tight">SMTP provider</h3>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed max-w-md">
            Optional fallback. Connect Gmail, Outlook, Zoho, Hostinger, or any custom SMTP server.
          </p>

          {hasPersonalSmtp ? (
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-stone-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-900 truncate">{settings.smtpEmail}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {savedPreset.label}
                    {settings.smtpHost ? ` · ${settings.smtpHost}:${settings.smtpPort || 587}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={openSmtpModal} className="btn-secondary !text-sm !px-3">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="btn-ghost !text-red-600 hover:!bg-red-50 !text-sm !px-3"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/40 p-4">
              <p className="text-sm text-stone-500">No SMTP provider connected.</p>
              <button type="button" onClick={openSmtpModal} className="btn-primary w-full sm:w-auto">
                Connect provider
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card-ats-bordered px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            campaignsActive ? 'bg-violet-50 text-violet-600' : 'bg-stone-100 text-stone-400'
          }`}>
            <Zap className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-stone-900">Marketing email</p>
            <p className="text-xs text-stone-500 truncate">
              {campaignsActive
                ? 'Zoho Campaigns is connected for tracked sends.'
                : 'Ask an admin to add the Campaigns API key on the server.'}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
          campaignsActive
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-stone-100 text-stone-500 border-stone-200'
        }`}>
          {campaignsActive ? 'Active' : 'Not set'}
        </span>
      </div>

      <Modal
        open={showSmtpModal}
        onClose={() => setShowSmtpModal(false)}
        title={hasPersonalSmtp ? 'Edit SMTP provider' : 'Connect SMTP provider'}
        description="Pick your email provider. We verify the connection before saving."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setShowSmtpModal(false)} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="button" onClick={handleTestDraft} disabled={testing || !draft.smtpEmail} className="btn-secondary">
              {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {testing ? 'Testing…' : 'Test'}
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !draft.smtpEmail} className="btn-primary">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Verifying…' : 'Save & verify'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {providerGroups.map((group) => {
            const items = SMTP_PRESETS.filter((p) => p.group === group.key);
            if (!items.length) return null;
            return (
              <div key={group.key}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">{group.label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((preset) => {
                    const active = draft.smtpProvider === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectProvider(preset.id)}
                        className={`px-3.5 py-3 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-400'
                            : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            active ? 'bg-brand-100 text-brand-600' : 'bg-stone-100 text-stone-500'
                          }`}>
                            {preset.id === 'custom' ? <Server className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-bold tracking-tight ${active ? 'text-brand-700' : 'text-stone-800'}`}>
                              {preset.label}
                            </p>
                            <p className="text-[11px] text-stone-400 truncate">{preset.hint}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {isCustom ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="label-ats">SMTP host</label>
                <input
                  type="text"
                  value={draft.smtpHost}
                  onChange={(e) => setDraft((prev) => ({ ...prev, smtpHost: e.target.value }))}
                  placeholder="smtp.yourdomain.com"
                  className="input-ats"
                />
              </div>
              <div>
                <label className="label-ats">Port</label>
                <input
                  type="number"
                  value={draft.smtpPort}
                  onChange={(e) => setDraft((prev) => ({ ...prev, smtpPort: parseInt(e.target.value, 10) || 587 }))}
                  placeholder="587"
                  className="input-ats"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-500">
              <Server size={13} className="text-stone-400" />
              <span className="font-mono font-semibold text-stone-700">
                {draftPreset.host}:{draftPreset.port}
              </span>
              <span className="ml-auto text-stone-400">auto</span>
            </div>
          )}

          <div>
            <label className="label-ats">Email address</label>
            <input
              type="email"
              value={draft.smtpEmail}
              onChange={(e) => setDraft((prev) => ({ ...prev, smtpEmail: e.target.value }))}
              placeholder="you@company.com"
              className="input-ats"
              autoFocus
            />
          </div>

          <div>
            <label className="label-ats">
              {['gmail', 'yahoo', 'outlook'].includes(draft.smtpProvider) ? 'App password' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={draft.smtpAppPassword}
                onChange={(e) => setDraft((prev) => ({ ...prev, smtpAppPassword: e.target.value }))}
                placeholder={draft.hasPassword ? 'Leave blank to keep current' : 'Password or app password'}
                className="input-ats !pr-12 font-mono"
              />
              <button
                type="button"
                onClick={revealPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[11px] text-stone-400 mt-1.5">{draftPreset.hint}. Connection is verified on save.</p>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={handleRemove}
        title="Remove SMTP?"
        message="Your SMTP provider will be disconnected. Email will use ZeptoMail when available."
        confirmText="Remove"
        type="delete"
        isLoading={removing}
      />
    </div>
  );
};

export default EmailSettingsPage;
