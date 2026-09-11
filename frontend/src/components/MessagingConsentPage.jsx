import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Loader2, Save, RefreshCw } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { CONSENT_TOUR_KEY, CONSENT_TOUR_STEPS } from './messagingConsent/consentConstants';
import { ConsentCandidateList, ConsentPanel } from './messagingConsent/ConsentPanels';

export default function MessagingConsentPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(CONSENT_TOUR_KEY);
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    email: true,
    sms: false,
    whatsapp: false,
    talentPoolOptIn: false,
    phoneVerified: false
  });
  const [savedForm, setSavedForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const search = useCallback(async () => {
    if (!q.trim()) {
      setCandidates([]);
      return;
    }
    setSearching(true);
    try {
      const res = await authenticatedFetch(`/candidates?search=${encodeURIComponent(q.trim())}&limit=15`);
      const data = await readApiJson(res);
      setCandidates(data.data || []);
    } catch (e) {
      toast.error(e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [q, toast]);

  useEffect(() => {
    const t = setTimeout(search, 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadConsent = async (c) => {
    setSelected(c);
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/consent/candidate/${c._id}`);
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      const mc = data.data.messagingConsent || {};
      const next = {
        email: mc.email !== false,
        sms: !!mc.sms,
        whatsapp: !!mc.whatsapp,
        talentPoolOptIn: !!data.data.talentPoolConsent?.optedIn,
        phoneVerified: !!data.data.phoneVerifiedAt
      };
      setForm(next);
      setSavedForm(next);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const revokedChannels = useMemo(() => {
    if (!savedForm) return [];
    const labels = [];
    if (savedForm.email && !form.email) labels.push('Email');
    if (savedForm.sms && !form.sms) labels.push('SMS');
    if (savedForm.whatsapp && !form.whatsapp) labels.push('WhatsApp');
    if (savedForm.talentPoolOptIn && !form.talentPoolOptIn) labels.push('Talent pool');
    return labels;
  }, [form, savedForm]);

  const dirty = useMemo(() => {
    if (!savedForm) return false;
    return Object.keys(form).some((k) => form[k] !== savedForm[k]);
  }, [form, savedForm]);

  const persist = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/api/consent/candidate/${selected._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Consent updated');
      setSavedForm({ ...form });
      setConfirmSaveOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    if (!selected || !dirty) return;
    if (revokedChannels.length > 0) {
      setConfirmSaveOpen(true);
      return;
    }
    persist();
  };

  const listLabel = !q.trim()
    ? 'Search to begin'
    : searching
      ? 'Searching…'
      : `${candidates.length} result${candidates.length === 1 ? '' : 's'}`;

  return (
    <FeatureGate
      feature="messaging.consent"
      fallback={
        <UpgradeFeatureFallback
          title="Messaging consent is a Professional feature"
          description="Upgrade to manage TCPA / GDPR channel opt-in and talent-pool retention consent."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={ShieldCheck}
          title={t('pages.messagingConsent.title')}
          subtitle="TCPA / GDPR channel opt-in and talent-pool consent."
          gradientTitle
        >
          {selected && (
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => loadConsent(selected)}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Reload
            </button>
          )}
          {selected && (
            <button
              data-tour="consent-save"
              type="button"
              className="btn-primary w-full sm:w-auto"
              disabled={saving || loading || !dirty}
              onClick={requestSave}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save consent
            </button>
          )}
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          Only message candidates on channels they’ve opted into. Sequences and inbox respect these switches.
          Press <span className="font-semibold text-stone-800">?</span> bottom-right for a tour.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-[32rem]">
          <ConsentCandidateList
            q={q}
            setQ={setQ}
            listLabel={listLabel}
            searching={searching}
            candidates={candidates}
            selected={selected}
            loadConsent={loadConsent}
          />
          <ConsentPanel
            selected={selected}
            loading={loading}
            dirty={dirty}
            form={form}
            setForm={setForm}
            saving={saving}
            requestSave={requestSave}
          />
        </div>

        <ConfirmationModal
          isOpen={confirmSaveOpen}
          onClose={() => setConfirmSaveOpen(false)}
          onConfirm={persist}
          title="Revoke consent?"
          message={`You’re turning off: ${revokedChannels.join(', ')}. Future outreach on those channels will be blocked for this candidate.`}
          confirmText="Save changes"
          type="warning"
          isLoading={saving}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Messaging Consent" />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={CONSENT_TOUR_STEPS}
          storageKey={CONSENT_TOUR_KEY}
        />
      </div>
    </FeatureGate>
  );
}
