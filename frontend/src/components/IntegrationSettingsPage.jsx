import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug } from 'lucide-react';
import API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';
import EmptyState from './ui/EmptyState';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { useToast } from './Toast';
import {
  INTEGRATIONS_TOUR_KEY, INTEGRATIONS_TOUR_STEPS, SECTIONS,
} from './integrationSettings/integrationConstants';
import { Section, LoadingSkeleton } from './integrationSettings/IntegrationLayout';
import ProviderCard from './integrationSettings/ProviderCard';
import IntegrationFilters from './integrationSettings/IntegrationFilters';
import ConfigureModal from './integrationSettings/ConfigureModal';

export default function IntegrationSettingsPage() {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(INTEGRATIONS_TOUR_KEY);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...SECTIONS.map((s) => ({ value: s.title, label: s.title })),
    ],
    []
  );

  const connectedCount = useMemo(
    () => configs.filter((c) => c.isActive !== false && c.hasCredentials).length,
    [configs]
  );

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setConfigs(data.data || []);
      } else {
        toast.error(data.message || 'Could not load integrations. Try again shortly.');
      }
    } catch (err) {
      console.error('Failed to load integrations:', err);
      toast.error('Could not load integrations. Try again shortly.');
    } finally {
      setLoading(false);
    }
  // toast omitted from deps — provider recreates api each render
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const getConfigFor = (providerId) => configs.find((c) => c.provider === providerId);

  const openConfigure = (provider) => {
    setFeedback(null);
    setFormValues({});
    setActiveProvider(provider);
  };

  const closeConfigure = () => {
    if (saving || testing) return;
    setActiveProvider(null);
    setFormValues({});
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!activeProvider) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category: activeProvider.category || 'email',
          provider: activeProvider.id,
          displayName: activeProvider.name,
          credentials: formValues
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to save');
      setFeedback({ type: 'success', message: 'Saved. Click Test to verify.' });
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!activeProvider) return;
    const config = getConfigFor(activeProvider.id);
    if (!config) {
      setFeedback({ type: 'error', message: 'Save the configuration before testing.' });
      return;
    }
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/api/integrations/${config._id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Connection test failed');
      setFeedback({ type: 'success', message: data.message || 'Connection successful!' });
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleOAuthConnect = async (providerId) => {
    const path =
      providerId === 'google' ? '/api/integrations/oauth/google-calendar/auth-url'
        : providerId === 'outlook' ? '/api/integrations/oauth/outlook-calendar/auth-url'
          : null;
    if (!path) return;
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success || !data.authUrl) {
        throw new Error(data.message || 'Could not start OAuth');
      }
      window.location.href = data.authUrl;
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
      toast.error(err.message || 'Could not start OAuth');
    }
  };

  const handleDisconnect = async () => {
    const provider = disconnectTarget;
    if (!provider) return;
    const config = getConfigFor(provider.id);
    if (!config) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/${config._id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to disconnect');
      if (activeProvider?.id === provider.id) closeConfigure();
      setDisconnectTarget(null);
      toast.success(`${provider.name} disconnected`);
      await loadConfigs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
      toast.error(err.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const statusOf = (providerId) => {
      const config = configs.find((c) => c.provider === providerId);
      const connected = !!(config && config.isActive !== false && config.hasCredentials);
      if (!connected) return 'not_setup';
      return config?.isValidated ? 'connected' : 'unverified';
    };
    return SECTIONS
      .filter((s) => categoryFilter === 'all' || s.title === categoryFilter)
      .map((s) => {
        const providers = s.providers.filter((p) => {
          if (statusFilter !== 'all' && statusOf(p.id) !== statusFilter) return false;
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q)
            || p.desc.toLowerCase().includes(q)
            || p.category.toLowerCase().includes(q)
            || s.title.toLowerCase().includes(q)
          );
        });
        return { ...s, providers };
      })
      .filter((s) => s.providers.length > 0);
  }, [searchQuery, categoryFilter, statusFilter, configs]);

  const activeConfig = activeProvider ? getConfigFor(activeProvider.id) : null;

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Plug}
        title={t('pages.integrations.title')}
        subtitle="Connect email, calendars, AI, messaging, storage, HRIS, and more."
        gradientTitle
      />

      <div data-tour="integrations-tip" className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
        {connectedCount > 0
          ? `${connectedCount} provider${connectedCount === 1 ? '' : 's'} connected. Configure AI under AI / Scoring before using AI Tools.`
          : 'No providers connected yet. Start with Email or AI / Scoring — Save, then Test Connection.'}
        {' '}Press <span className="font-semibold text-stone-800">?</span> for a tour.
      </div>

      <IntegrationFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        categoryOptions={categoryOptions}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div data-tour="integrations-catalog" className="space-y-8">
          {filteredSections.length === 0 ? (
            <div className="card-ats-bordered">
              <EmptyState
                icon={Plug}
                tone="brand"
                message="No providers match"
                subMessage="Clear search or change category / status filters."
                action={
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('all');
                      setStatusFilter('all');
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            </div>
          ) : (
            filteredSections.map(({ title, icon, providers }) => (
              <Section key={title} title={title} icon={icon}>
                {providers.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    config={getConfigFor(provider.id)}
                    organization={organization}
                    onConfigure={openConfigure}
                  />
                ))}
              </Section>
            ))
          )}
        </div>
      )}

      <ConfigureModal
        activeProvider={activeProvider}
        activeConfig={activeConfig}
        formValues={formValues}
        setFormValues={setFormValues}
        feedback={feedback}
        saving={saving}
        testing={testing}
        onClose={closeConfigure}
        onSave={handleSave}
        onTest={handleTest}
        onDisconnect={setDisconnectTarget}
        onOAuthConnect={handleOAuthConnect}
      />

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

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Integrations" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={INTEGRATIONS_TOUR_STEPS}
        storageKey={INTEGRATIONS_TOUR_KEY}
      />
    </div>
  );
}
