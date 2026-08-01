import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Calendar, MessageSquare, Bot, Briefcase,
  Settings, CheckCircle2, AlertCircle, Loader2, Unlink, Lock, ShieldCheck, FileSignature
} from 'lucide-react';
import API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';

// Only providers with a real, working adapter appear here (see backend/adapters/).
// Calendar/SMS/AI push-posting-to-LinkedIn stay in "Coming Soon" until a
// real adapter backs them — showing them as configurable would be a UI lie.
const EMAIL_PROVIDERS = [
  { id: 'smtp', name: 'Custom SMTP', desc: 'Connect your own email server', category: 'email', icon: Mail, color: 'text-blue-500', bg: 'bg-blue-50', feature: null, fields: ['host', 'port', 'username', 'password', 'fromEmail'] },
  { id: 'zeptomail', name: 'Zoho ZeptoMail', desc: 'High deliverability transactional email', category: 'email', icon: Mail, color: 'text-yellow-500', bg: 'bg-yellow-50', feature: 'integrations.byoEmail', fields: ['apiKey', 'fromEmail'] },
  { id: 'sendgrid', name: 'SendGrid', desc: 'Cloud-based email delivery', category: 'email', icon: Mail, color: 'text-cyan-500', bg: 'bg-cyan-50', feature: 'integrations.byoEmail', fields: ['apiKey', 'fromEmail'] }
];

const JOB_BOARD_PROVIDERS = [
  { id: 'indeed_feed', name: 'Indeed / Google Jobs Feed', desc: 'Pull-based XML feed — submit your feed URL once in the board\'s publisher console', category: 'job_board', icon: Briefcase, color: 'text-indigo-500', bg: 'bg-indigo-50', feature: 'integrations.jobBoard', fields: ['feedUrl'] },
  { id: 'webhook', name: 'Custom Relay / Zapier', desc: 'Push job postings to your own middleware or a partner with LinkedIn/Naukri access', category: 'job_board', icon: Briefcase, color: 'text-purple-500', bg: 'bg-purple-50', feature: 'integrations.jobBoard', fields: ['webhookUrl'] }
];

const BACKGROUND_CHECK_PROVIDERS = [
  { id: 'checkr', name: 'Checkr', desc: 'Order and track background checks on candidates', category: 'background_check', icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50', feature: 'integrations.backgroundCheck', fields: ['apiKey', 'packageSlug'] }
];

const ESIGN_PROVIDERS = [
  { id: 'docusign', name: 'DocuSign', desc: 'Send offer letters out for e-signature', category: 'esign', icon: FileSignature, color: 'text-rose-500', bg: 'bg-rose-50', feature: 'integrations.esign', fields: ['accessToken', 'accountId', 'basePath'] }
];

const COMING_SOON = [
  { id: 'gcal', name: 'Google Calendar', desc: 'Sync interviews with Google Calendar', icon: Calendar },
  { id: 'outlook', name: 'Outlook Calendar', desc: 'Sync interviews with Microsoft Outlook', icon: Calendar },
  { id: 'twilio', name: 'Twilio SMS', desc: 'Send candidate updates via SMS/WhatsApp', icon: MessageSquare },
  { id: 'openai', name: 'AI Assistant', desc: 'Auto-generate job descriptions and summaries', icon: Bot },
  { id: 'linkedin', name: 'LinkedIn (direct push)', desc: 'Requires a LinkedIn Talent partner agreement — use the Custom Relay provider above until then', icon: Briefcase }
];

const FIELD_LABELS = {
  host: 'Host', port: 'Port', username: 'Username / Email', password: 'Password',
  fromEmail: 'From Email', apiKey: 'API Key', feedUrl: 'Public Feed URL', webhookUrl: 'Relay Webhook URL',
  packageSlug: 'Checkr Package Slug', accessToken: 'DocuSign Access Token', accountId: 'DocuSign Account ID', basePath: 'DocuSign Base Path (e.g. https://demo.docusign.net/restapi)'
};

export default function IntegrationSettingsPage() {
  const { organization, token } = useAuth();
  const [configs, setConfigs] = useState([]); // saved IntegrationConfig docs (no credentials)
  const [loading, setLoading] = useState(true);
  const [activeConfig, setActiveConfig] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok && data.success) setConfigs(data.data);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const getConfigFor = (providerId) => configs.find(c => c.provider === providerId);

  const openConfigure = (provider) => {
    setFeedback(null);
    setActiveConfig(activeConfig === provider.id ? null : provider.id);
    setFormValues({});
  };

  const handleSave = async (provider) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/api/integrations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          category: provider.category || 'email',
          provider: provider.id,
          displayName: provider.name,
          credentials: formValues
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to save');
      setFeedback({ type: 'success', message: 'Saved. Click Test to verify the connection.' });
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (provider) => {
    const config = getConfigFor(provider.id);
    if (!config) {
      setFeedback({ type: 'error', message: 'Save the configuration before testing.' });
      return;
    }
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/api/integrations/${config._id}/test`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Connection test failed');
      setFeedback({ type: 'success', message: data.message || 'Connection successful!' });
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async (provider) => {
    const config = getConfigFor(provider.id);
    if (!config) return;
    if (!window.confirm(`Disconnect ${provider.name}?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/integrations/${config._id}`, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to disconnect');
      setActiveConfig(null);
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const renderCard = (provider) => {
    const Icon = provider.icon;
    const config = getConfigFor(provider.id);
    const connected = !!(config && config.isActive !== false && config.hasCredentials);
    const validated = !!config?.isValidated;
    const entitled = !provider.feature || planHasFeature(organization?.plan, provider.feature);

    return (
      <div key={provider.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all overflow-hidden flex flex-col">
        <div className="p-5 flex-1">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${provider.bg || 'bg-gray-100'} ${provider.color || 'text-gray-500'}`}>
              <Icon className="w-6 h-6" />
            </div>
            {!entitled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                <Lock className="w-3 h-3" /> Upgrade required
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                connected ? (validated ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100') : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? (validated ? 'bg-green-500' : 'bg-amber-500') : 'bg-gray-400'}`}></span>
                {connected ? (validated ? 'Connected' : 'Unverified') : 'Not Configured'}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-gray-900">{provider.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{provider.desc}</p>
        </div>

        <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 mt-auto flex justify-end">
          <button
            onClick={() => entitled && openConfigure(provider)}
            disabled={!entitled}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Settings className="w-4 h-4" />
            {entitled ? 'Configure' : 'Upgrade to unlock'}
          </button>
        </div>

        {activeConfig === provider.id && entitled && (
          <div className="border-t border-gray-100 bg-gray-50 p-5">
            <div className="space-y-4">
              {provider.fields.map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{FIELD_LABELS[field] || field}</label>
                  <input
                    type={field === 'password' || field === 'apiKey' ? 'password' : 'text'}
                    value={formValues[field] || ''}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={config?.hasCredentials ? '•••••••••••• (leave blank to keep current)' : ''}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between pt-4 border-t border-gray-200">
              {config ? (
                <button onClick={() => handleDisconnect(provider)} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1">
                  <Unlink className="w-3.5 h-3.5" /> Disconnect
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button
                  onClick={() => handleTest(provider)}
                  disabled={testing || !config}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
                </button>
                <button
                  onClick={() => handleSave(provider)}
                  disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>

            {feedback && (
              <div className={`mt-3 text-xs flex items-center gap-1.5 p-2 rounded ${feedback.type === 'success' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {feedback.message}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Integrations</h1>
          <p className="text-gray-500 mt-1 text-sm">Connect your ATS with external tools and services.</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading integrations...</div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Email Providers</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {EMAIL_PROVIDERS.map(renderCard)}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Job Board (Enterprise)</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {JOB_BOARD_PROVIDERS.map(renderCard)}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Background Checks (Enterprise)</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {BACKGROUND_CHECK_PROVIDERS.map(renderCard)}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">E-Signature (Enterprise)</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ESIGN_PROVIDERS.map(renderCard)}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Coming Soon</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {COMING_SOON.map((integration) => {
                  const Icon = integration.icon;
                  return (
                    <div key={integration.id} className="bg-white rounded-xl border border-gray-100 opacity-60 overflow-hidden flex flex-col">
                      <div className="p-5 flex-1">
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-3 rounded-lg bg-gray-100 text-gray-500">
                            <Icon className="w-6 h-6" />
                          </div>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Coming Soon
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">{integration.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{integration.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
