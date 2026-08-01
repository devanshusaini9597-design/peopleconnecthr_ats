import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Calendar, MessageSquare, Bot, Briefcase,
  Settings, CheckCircle2, AlertCircle, Loader2, Unlink, Lock, ShieldCheck, FileSignature, Plug
} from 'lucide-react';
import API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';

// Only providers with a real, working adapter appear here (see backend/adapters/).
// Calendar/SMS/AI push-posting-to-LinkedIn stay in "Coming Soon" until a
// real adapter backs them — showing them as configurable would be a UI lie.
const EMAIL_PROVIDERS = [
  { id: 'smtp', name: 'Custom SMTP', desc: 'Connect your own email server', category: 'email', icon: Mail, color: 'text-brand-600', bg: 'bg-brand-50', feature: null, fields: ['host', 'port', 'username', 'password', 'fromEmail'] },
  { id: 'zeptomail', name: 'Zoho ZeptoMail', desc: 'High deliverability transactional email', category: 'email', icon: Mail, color: 'text-amber-500', bg: 'bg-amber-50', feature: 'integrations.byoEmail', fields: ['apiKey', 'fromEmail'] },
  { id: 'sendgrid', name: 'SendGrid', desc: 'Cloud-based email delivery', category: 'email', icon: Mail, color: 'text-teal-600', bg: 'bg-teal-50', feature: 'integrations.byoEmail', fields: ['apiKey', 'fromEmail'] }
];

const JOB_BOARD_PROVIDERS = [
  { id: 'indeed_feed', name: 'Indeed / Google Jobs Feed', desc: 'Pull-based XML feed — submit your feed URL once in the board\'s publisher console', category: 'job_board', icon: Briefcase, color: 'text-brand-600', bg: 'bg-brand-50', feature: 'integrations.jobBoard', fields: ['feedUrl'] },
  { id: 'webhook', name: 'Custom Relay / Zapier', desc: 'Push job postings to your own middleware or a partner with LinkedIn/Naukri access', category: 'job_board', icon: Briefcase, color: 'text-teal-600', bg: 'bg-teal-50', feature: 'integrations.jobBoard', fields: ['webhookUrl'] }
];

const BACKGROUND_CHECK_PROVIDERS = [
  { id: 'checkr', name: 'Checkr', desc: 'Order and track background checks on candidates', category: 'background_check', icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50', feature: 'integrations.backgroundCheck', fields: ['apiKey', 'packageSlug'] }
];

const ESIGN_PROVIDERS = [
  { id: 'docusign', name: 'DocuSign', desc: 'Send offer letters out for e-signature', category: 'esign', icon: FileSignature, color: 'text-rose-500', bg: 'bg-rose-50', feature: 'integrations.esign', fields: ['accessToken', 'accountId', 'basePath'] }
];

const WHATSAPP_PROVIDERS = [
  { id: 'twilio_whatsapp', name: 'Twilio WhatsApp', desc: 'Send automated, logged WhatsApp messages from your own Twilio sender', category: 'whatsapp', icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-50', feature: 'integrations.whatsapp', fields: ['accountSid', 'authToken', 'fromNumber'] }
];

const COMING_SOON = [
  { id: 'gcal', name: 'Google Calendar', desc: 'Sync interviews with Google Calendar', icon: Calendar },
  { id: 'outlook', name: 'Outlook Calendar', desc: 'Sync interviews with Microsoft Outlook', icon: Calendar },
  { id: 'openai', name: 'AI Assistant', desc: 'Auto-generate job descriptions and summaries', icon: Bot },
  { id: 'linkedin', name: 'LinkedIn (direct push)', desc: 'Requires a LinkedIn Talent partner agreement — use the Custom Relay provider above until then', icon: Briefcase }
];

const FIELD_LABELS = {
  host: 'Host', port: 'Port', username: 'Username / Email', password: 'Password',
  fromEmail: 'From Email', apiKey: 'API Key', feedUrl: 'Public Feed URL', webhookUrl: 'Relay Webhook URL',
  packageSlug: 'Checkr Package Slug', accessToken: 'DocuSign Access Token', accountId: 'DocuSign Account ID', basePath: 'DocuSign Base Path (e.g. https://demo.docusign.net/restapi)',
  accountSid: 'Twilio Account SID', authToken: 'Twilio Auth Token', fromNumber: 'WhatsApp Sender Number (e.g. whatsapp:+14155238886)'
};

const Section = ({ title, children }) => (
  <section>
    <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider mb-4 border-b border-stone-200 pb-2 flex items-center gap-2">
      {title}
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {children}
    </div>
  </section>
);

const LoadingSkeleton = () => (
  <div className="space-y-8 animate-fade-in">
    {[1, 2, 3].map((section) => (
      <div key={section}>
        <div className="h-4 w-40 skeleton-ats mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {[1, 2, 3].map((card) => (
            <div key={card} className="card-ats-bordered p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 skeleton-ats rounded-xl" />
                <div className="h-6 w-24 skeleton-ats rounded-full" />
              </div>
              <div className="h-4 w-2/3 skeleton-ats" />
              <div className="h-3 w-full skeleton-ats" />
              <div className="h-3 w-4/5 skeleton-ats" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default function IntegrationSettingsPage() {
  const { organization, token } = useAuth();
  const [configs, setConfigs] = useState([]); // saved IntegrationConfig docs (no credentials)
  const [loading, setLoading] = useState(true);
  const [activeConfig, setActiveConfig] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

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

  const handleDisconnect = async () => {
    const provider = disconnectTarget;
    if (!provider) return;
    const config = getConfigFor(provider.id);
    if (!config) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/${config._id}`, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to disconnect');
      setActiveConfig(null);
      setDisconnectTarget(null);
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  const renderCard = (provider) => {
    const Icon = provider.icon;
    const config = getConfigFor(provider.id);
    const connected = !!(config && config.isActive !== false && config.hasCredentials);
    const validated = !!config?.isValidated;
    const entitled = !provider.feature || planHasFeature(organization?.plan, provider.feature);

    return (
      <div key={provider.id} className="card-ats-bordered overflow-hidden flex flex-col">
        <div className="p-5 flex-1">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className={`p-3 rounded-xl ${provider.bg || 'bg-stone-100'} ${provider.color || 'text-stone-500'}`}>
              <Icon className="w-6 h-6" />
            </div>
            {!entitled ? (
              <span className="badge-warning inline-flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Upgrade required
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 ${
                connected
                  ? (validated ? 'badge-success' : 'badge-warning')
                  : 'badge-neutral'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? (validated ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-stone-400'}`} />
                {connected ? (validated ? 'Connected' : 'Unverified') : 'Not Configured'}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-stone-900 tracking-tight">{provider.name}</h3>
          <p className="text-sm text-stone-500 mt-1 leading-relaxed">{provider.desc}</p>
        </div>

        <div className="px-5 py-3 bg-stone-50/50 border-t border-stone-100 mt-auto flex justify-end">
          <button
            type="button"
            onClick={() => entitled && openConfigure(provider)}
            disabled={!entitled}
            className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
          >
            <Settings className="w-4 h-4" />
            {entitled ? 'Configure' : 'Upgrade to unlock'}
          </button>
        </div>

        {activeConfig === provider.id && entitled && (
          <div className="border-t border-stone-100 bg-stone-50/80 p-5">
            <div className="space-y-4">
              {provider.fields.map((field) => (
                <div key={field}>
                  <label className="label-ats !text-xs">{FIELD_LABELS[field] || field}</label>
                  <input
                    type={field === 'password' || field === 'apiKey' || field === 'authToken' || field === 'accessToken' ? 'password' : 'text'}
                    value={formValues[field] || ''}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={config?.hasCredentials ? '•••••••••••• (leave blank to keep current)' : ''}
                    className="input-ats"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-stone-200">
              {config ? (
                <button
                  type="button"
                  onClick={() => setDisconnectTarget(provider)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1.5 min-h-[44px] sm:min-h-0"
                >
                  <Unlink className="w-3.5 h-3.5" /> Disconnect
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTest(provider)}
                  disabled={testing || !config}
                  className="btn-secondary !px-3 !py-1.5 !text-sm flex-1 sm:flex-none"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(provider)}
                  disabled={saving}
                  className="btn-primary !px-3 !py-1.5 !text-sm flex-1 sm:flex-none"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>

            {feedback && (
              <div className={`mt-3 text-xs flex items-center gap-1.5 p-2.5 rounded-xl ${feedback.type === 'success' ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {feedback.message}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-shell-ats">
      <PageHeader
        icon={Plug}
        title="Integrations"
        subtitle="Connect your ATS with external tools and services."
        gradientTitle
      />

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <Section title="Email Providers">
            {EMAIL_PROVIDERS.map(renderCard)}
          </Section>

          <Section title="Job Board (Enterprise)">
            {JOB_BOARD_PROVIDERS.map(renderCard)}
          </Section>

          <Section title="Background Checks (Enterprise)">
            {BACKGROUND_CHECK_PROVIDERS.map(renderCard)}
          </Section>

          <Section title="E-Signature (Enterprise)">
            {ESIGN_PROVIDERS.map(renderCard)}
          </Section>

          <Section title="WhatsApp Messaging (Enterprise)">
            {WHATSAPP_PROVIDERS.map(renderCard)}
          </Section>

          <section>
            <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4 border-b border-stone-100 pb-2">
              Coming Soon
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {COMING_SOON.map((integration) => {
                const Icon = integration.icon;
                return (
                  <div key={integration.id} className="card-ats-bordered opacity-60 overflow-hidden flex flex-col">
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-xl bg-stone-100 text-stone-500">
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="badge-neutral">Coming Soon</span>
                      </div>
                      <h3 className="text-base font-semibold text-stone-900 tracking-tight">{integration.name}</h3>
                      <p className="text-sm text-stone-500 mt-1 leading-relaxed">{integration.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <ConfirmationModal
        isOpen={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnect}
        title="Disconnect integration?"
        message={`Disconnect ${disconnectTarget?.name}? Saved credentials will be removed.`}
        confirmText="Disconnect"
        type="delete"
        isLoading={disconnecting}
      />
    </div>
  );
}
