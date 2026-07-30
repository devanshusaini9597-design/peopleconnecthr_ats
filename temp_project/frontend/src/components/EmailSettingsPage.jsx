import React, { useState, useEffect } from 'react';
import { Mail, Settings, Save, TestTube, Eye, EyeOff, CheckCircle, AlertCircle, Trash2, Shield, Loader2, Info, Globe, Server, Zap } from 'lucide-react';
import Layout from './Layout';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

import API_URL from '../config';
const BASE = API_URL;

const SMTP_PRESETS = {
  hostinger: { label: 'Hostinger',    host: 'smtp.hostinger.com',  port: 587, desc: 'Hostinger domain email' },
  custom:    { label: 'Custom SMTP',  host: '',                    port: 587, desc: 'Enter your own SMTP server details' },
};

const EmailSettingsPage = () => {
  const toast = useToast();
  const loggedInEmail = localStorage.getItem('userEmail') || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingCurrent, setTestingCurrent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [zeptoActive, setZeptoActive] = useState(false);
  const [zeptoFrom, setZeptoFrom] = useState('');
  const [campaignsActive, setCampaignsActive] = useState(false);
  const [settings, setSettings] = useState({
    smtpEmail: '',
    smtpAppPassword: '',
    smtpProvider: 'hostinger',
    smtpHost: 'smtp.hostinger.com',
    smtpPort: 587,
    isConfigured: false,
    hasPassword: false
  });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const [settingsRes, channelsRes] = await Promise.all([
        authenticatedFetch(`${BASE}/api/email-settings`),
        authenticatedFetch(`${BASE}/api/email/channels`)
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
        if (chData.success && chData.channels?.marketing) setCampaignsActive(chData.channels.marketing.available);
      } catch (_) {}
    } catch (err) {
      console.error('Fetch settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectProvider = (key) => {
    const preset = SMTP_PRESETS[key];
    setSettings(prev => ({
      ...prev,
      smtpProvider: key,
      smtpHost: preset.host || prev.smtpHost,
      smtpPort: preset.port || prev.smtpPort
    }));
  };

  const handleSave = async () => {
    if (!settings.smtpEmail) return toast.error('Email address is required');
    if (!settings.smtpAppPassword && !settings.hasPassword) return toast.error('Password is required');
    if (settings.smtpProvider === 'custom' && !settings.smtpHost) return toast.error('SMTP Host is required for custom provider');
    setSaving(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Email settings verified & saved!');
        setSettings(data.settings);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings.smtpEmail) return toast.error('Enter your email first');
    if (!settings.smtpAppPassword && !settings.hasPassword) return toast.error('Enter your password first');
    setTesting(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
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
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Test failed.');
    } finally {
      setTestingCurrent(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove your SMTP settings? Emails will be sent via ZeptoMail (default).')) return;
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings`, { method: 'DELETE' });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setSettings({ smtpEmail: '', smtpAppPassword: '', smtpProvider: 'hostinger', smtpHost: 'smtp.hostinger.com', smtpPort: 587, isConfigured: false, hasPassword: false });
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Failed to remove settings');
    }
  };

  const isCustom = settings.smtpProvider === 'custom';
  const activePreset = SMTP_PRESETS[settings.smtpProvider] || SMTP_PRESETS.hostinger;
  const hasPersonalSmtp = settings.isConfigured && settings.hasPassword && settings.smtpEmail;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Settings size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Email Settings</h1>
              <p className="text-xs text-gray-500">ZeptoMail is the default sender. Optionally configure Hostinger SMTP below.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestCurrentConfig}
            disabled={testingCurrent}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 disabled:opacity-50"
            title="Send a test email using the active config"
          >
            {testingCurrent ? <Loader2 size={16} className="animate-spin" /> : <TestTube size={16} />}
            {testingCurrent ? 'Sending...' : 'Test Current Config'}
          </button>
        </div>

        {/* ZeptoMail Default Banner */}
        {zeptoActive ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Zap size={18} className="text-emerald-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">Zoho ZeptoMail — Active (Default)</p>
              <p className="text-xs text-emerald-600">
                All emails are sent via ZeptoMail from <strong>{zeptoFrom}</strong>.
                {hasPersonalSmtp && <> Your Hostinger SMTP below is saved but ZeptoMail takes priority.</>}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">ZeptoMail Not Configured</p>
              <p className="text-xs text-amber-600">Configure Hostinger SMTP below, or ask your admin to add the ZeptoMail API key to the server.</p>
            </div>
          </div>
        )}

        {/* Zoho Campaigns Banner */}
        {campaignsActive ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl">
            <Mail size={18} className="text-purple-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-800">Zoho Campaigns — Active (Marketing)</p>
              <p className="text-xs text-purple-600">Marketing emails use Zoho Campaigns with open/click tracking.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
            <Mail size={18} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-600">Zoho Campaigns — Not Configured</p>
              <p className="text-xs text-gray-400">Add the Campaigns API key to enable marketing emails with tracking.</p>
            </div>
          </div>
        )}

        {/* Personal SMTP Status */}
        {hasPersonalSmtp && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <CheckCircle size={18} className="text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">Hostinger SMTP — Configured</p>
              <p className="text-xs text-blue-600">Sending from <strong>{settings.smtpEmail}</strong> (used when ZeptoMail is not available)</p>
            </div>
            <button onClick={handleRemove} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Remove SMTP settings">
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* STEP 1: Choose Provider */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Globe size={15} className="text-indigo-500" /> SMTP Provider (Optional Fallback)
            </h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(SMTP_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => selectProvider(key)}
                  className={`px-4 py-3 rounded-lg border text-left transition-all ${
                    settings.smtpProvider === key
                      ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-sm font-semibold ${settings.smtpProvider === key ? 'text-indigo-700' : 'text-gray-700'}`}>{preset.label}</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* STEP 2: Credentials */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Mail size={15} className="text-indigo-500" /> SMTP Credentials
            </h2>
          </div>

          <div className="p-6 space-y-4">
            {/* Custom SMTP Host & Port */}
            {isCustom && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">SMTP Host</label>
                  <div className="relative">
                    <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={settings.smtpHost}
                      onChange={(e) => setSettings(prev => ({ ...prev, smtpHost: e.target.value }))}
                      placeholder="smtp.yourdomain.com"
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Port</label>
                  <input
                    type="number"
                    value={settings.smtpPort}
                    onChange={(e) => setSettings(prev => ({ ...prev, smtpPort: parseInt(e.target.value) || 587 }))}
                    placeholder="587"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">587 (TLS) or 465 (SSL)</p>
                </div>
              </div>
            )}

            {/* Auto-filled host for Hostinger */}
            {!isCustom && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                <Server size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">SMTP Server:</span>
                <span className="text-xs font-semibold text-gray-700">{activePreset.host}:{activePreset.port}</span>
                <span className="text-[10px] text-gray-400 ml-auto">(auto-configured)</span>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
              <input
                type="email"
                value={settings.smtpEmail}
                onChange={(e) => setSettings(prev => ({ ...prev, smtpEmail: e.target.value }))}
                placeholder="hr@yourcompany.com"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">Your Hostinger domain email address</p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.smtpAppPassword}
                  onChange={(e) => setSettings(prev => ({ ...prev, smtpAppPassword: e.target.value }))}
                  placeholder={settings.hasPassword ? '••••••••••••••••' : 'Your email password'}
                  className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!showPassword && settings.hasPassword && settings.smtpAppPassword === '••••••••••••••••') {
                      try {
                        const res = await authenticatedFetch(`${BASE}/api/email-settings/reveal-password`);
                        if (res.ok) {
                          const data = await res.json();
                          if (data.success) {
                            setSettings(prev => ({ ...prev, smtpAppPassword: data.password }));
                          }
                        }
                      } catch (err) {
                        console.error('Reveal password error:', err);
                      }
                    }
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Hostinger help */}
            {!isCustom && (
              <div className="bg-emerald-50 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <Info size={14} /> Hostinger Domain Email
                </h3>
                <ul className="text-xs text-emerald-700 space-y-1 ml-4 list-disc">
                  <li>Use your full domain email (e.g., <strong>hr@yourcompany.com</strong>)</li>
                  <li>Use the email account password you created in your Hostinger panel</li>
                  <li>SMTP: <strong>smtp.hostinger.com</strong> — Port: <strong>587</strong> (auto-configured)</li>
                </ul>
              </div>
            )}

            {isCustom && (
              <div className="bg-gray-100 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Info size={14} /> Custom SMTP Server
                </h3>
                <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                  <li>Enter your SMTP host (e.g., <strong>smtp.yourdomain.com</strong>)</li>
                  <li>Common ports: <strong>587</strong> (TLS/STARTTLS) or <strong>465</strong> (SSL)</li>
                  <li>Use your full email address and email password</li>
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving || !settings.smtpEmail}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
            >
              {saving ? <><Loader2 size={15} className="animate-spin" /> Verifying & Saving...</> : <><Save size={15} /> Save SMTP</>}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !settings.smtpEmail}
              className="px-5 py-2.5 bg-white text-indigo-600 border border-indigo-200 text-sm font-semibold rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {testing ? <><Loader2 size={15} className="animate-spin" /> Sending test...</> : <><TestTube size={15} /> Test SMTP</>}
            </button>
          </div>
        </div>

        {/* Security Note */}
        <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <Shield size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-gray-700">Security</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Your SMTP password is stored securely and never shown after saving. Each user can only access their own settings.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EmailSettingsPage;
