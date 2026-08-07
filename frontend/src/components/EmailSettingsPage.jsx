import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, RefreshCw } from 'lucide-react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import API_URL from '../config';
import {
  EMAIL_TOUR_KEY,
  EMAIL_TOUR_STEPS,
  emptySmtp,
  presetById,
} from './emailSettings/emailSettingsConstants';
import EmailStatusPanel from './emailSettings/EmailStatusPanel';
import MailboxPanel from './emailSettings/MailboxPanel';
import HowSendingWorks from './emailSettings/HowSendingWorks';
import SmtpConnectModal from './emailSettings/SmtpConnectModal';

const BASE = API_URL;

const EmailSettingsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(EMAIL_TOUR_KEY);
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
    setLoading(true);
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
      } catch {
        /* silent */
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
      toast.error('Failed to load email settings');
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
      return toast.error('Server address is required for custom provider');
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
        toast.success(data.message || 'Email connected');
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
  const savedPreset = presetById(settings.smtpProvider);
  const hasPersonalSmtp = settings.isConfigured && settings.hasPassword && settings.smtpEmail;
  const activeSender = zeptoActive
    ? { label: 'Platform email (ZeptoMail)', detail: zeptoFrom || 'Default transactional sender', ok: true }
    : hasPersonalSmtp
      ? { label: savedPreset.label, detail: settings.smtpEmail, ok: true }
      : { label: 'Not connected', detail: 'Connect a mailbox so the ATS can send email.', ok: false };

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-44 skeleton-ats rounded-lg" />
            <div className="h-4 w-64 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-2">
          <div className="lg:col-span-8 space-y-4">
            <div className="h-28 skeleton-ats rounded-2xl" />
            <div className="h-40 skeleton-ats rounded-2xl" />
          </div>
          <div className="lg:col-span-4 h-48 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <FeatureGate
      feature="integrations.byoEmail"
      fallback={(
        <UpgradeFeatureFallback
          title="Email Settings is a Professional feature"
          description="Upgrade to connect Gmail, Outlook, or your company mailbox for ATS outbound email."
        />
      )}
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Mail}
          title={t('pages.emailSettings.title')}
          subtitle="Connect the mailbox SkillNix uses to send candidate and team emails."
          gradientTitle
        >
          <button type="button" onClick={fetchSettings} className="btn-secondary w-full sm:w-auto">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          Pick Gmail or Outlook, enter your email and password (or app password), then save.
          No coding — press <span className="font-semibold text-stone-800">?</span> for a tour.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-8 min-w-0 space-y-4">
            <EmailStatusPanel
              activeSender={activeSender}
              zeptoActive={zeptoActive}
              hasPersonalSmtp={hasPersonalSmtp}
              savedPreset={savedPreset}
              settings={settings}
              testingCurrent={testingCurrent}
              onTest={handleTestCurrentConfig}
            />
            <MailboxPanel
              hasPersonalSmtp={hasPersonalSmtp}
              settings={settings}
              savedPreset={savedPreset}
              campaignsActive={campaignsActive}
              onEdit={openSmtpModal}
              onRemove={() => setConfirmRemove(true)}
            />
          </div>

          <HowSendingWorks />
        </div>

        <SmtpConnectModal
          open={showSmtpModal}
          onClose={() => setShowSmtpModal(false)}
          hasPersonalSmtp={hasPersonalSmtp}
          draft={draft}
          setDraft={setDraft}
          isCustom={isCustom}
          showPassword={showPassword}
          saving={saving}
          testing={testing}
          onSelectProvider={selectProvider}
          onRevealPassword={revealPassword}
          onTest={handleTestDraft}
          onSave={handleSave}
        />

        <ConfirmationModal
          isOpen={confirmRemove}
          onClose={() => setConfirmRemove(false)}
          onConfirm={handleRemove}
          title="Disconnect mailbox?"
          message="Your connected mailbox will be removed. Email will use platform sending when available."
          confirmText="Disconnect"
          type="delete"
          isLoading={removing}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Email Settings" />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={EMAIL_TOUR_STEPS}
          storageKey={EMAIL_TOUR_KEY}
        />
      </div>
    </FeatureGate>
  );
};

export default EmailSettingsPage;
