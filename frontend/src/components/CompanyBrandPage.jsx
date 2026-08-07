import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, Save, RefreshCw } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  BRAND_TOUR_KEY,
  BRAND_TOUR_STEPS,
  emptyBrand,
} from './companyBrand/companyBrandConstants';
import {
  BrandIdentitySection,
  BrandBenefitsSection,
  BrandTeamSection,
  BrandSeoSection,
  BrandPreviewAside,
} from './companyBrand/BrandFormSections';

export default function CompanyBrandPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(BRAND_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brandColor, setBrandColor] = useState('#0d9488');
  const [careersPageTitle, setCareersPageTitle] = useState('');
  const [careersPageDescription, setCareersPageDescription] = useState('');
  const [companyBrand, setCompanyBrand] = useState(emptyBrand());
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/company-brand');
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setBrandColor(data.data.brandColor || '#0d9488');
      setCareersPageTitle(data.data.careersPageTitle || '');
      setCareersPageDescription(data.data.careersPageDescription || '');
      setCompanyBrand({ ...emptyBrand(), ...data.data.companyBrand });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/company-brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandColor, careersPageTitle, careersPageDescription, companyBrand })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Brand pack saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    if (removeTarget.type === 'benefit') {
      setCompanyBrand((prev) => ({
        ...prev,
        benefits: (prev.benefits || []).filter((_, idx) => idx !== removeTarget.index)
      }));
    } else if (removeTarget.type === 'team') {
      setCompanyBrand((prev) => ({
        ...prev,
        teamMembers: (prev.teamMembers || []).filter((_, idx) => idx !== removeTarget.index)
      }));
    }
    setRemoveTarget(null);
  };

  const removeMessage = useMemo(() => {
    if (!removeTarget) return '';
    if (removeTarget.type === 'benefit') {
      const title = companyBrand.benefits?.[removeTarget.index]?.title;
      return `Remove benefit “${title || 'untitled'}” from your brand pack?`;
    }
    const name = companyBrand.teamMembers?.[removeTarget.index]?.name;
    return `Remove team member “${name || 'untitled'}” from your brand pack?`;
  }, [removeTarget, companyBrand]);

  return (
    <FeatureGate
      feature="careers.companyBrand"
      fallback={
        <UpgradeFeatureFallback
          title="Company brand builder is a Professional feature"
          description="Upgrade to manage benefits, team, SEO, and careers branding."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Building2}
          title={t('pages.companyBrand.title')}
          subtitle="Benefits, team, SEO, and careers branding."
          gradientTitle
        >
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            data-tour="brand-save"
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="btn-primary w-full sm:w-auto"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save brand
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          This brand pack powers your public careers experience. Preview updates as you type — save when ready.
          Press <span className="font-semibold text-stone-800">?</span> bottom-right for a tour.
        </div>

        {loading ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-8 space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-40 skeleton-ats rounded-2xl" />)}
            </div>
            <div className="xl:col-span-4"><div className="h-80 skeleton-ats rounded-2xl" /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            <div data-tour="brand-content" className="xl:col-span-8 space-y-4 min-w-0">
              <BrandIdentitySection
                brandColor={brandColor}
                setBrandColor={setBrandColor}
                companyBrand={companyBrand}
                setCompanyBrand={setCompanyBrand}
                careersPageTitle={careersPageTitle}
                setCareersPageTitle={setCareersPageTitle}
                careersPageDescription={careersPageDescription}
                setCareersPageDescription={setCareersPageDescription}
              />
              <BrandBenefitsSection
                companyBrand={companyBrand}
                setCompanyBrand={setCompanyBrand}
                setRemoveTarget={setRemoveTarget}
              />
              <BrandTeamSection
                companyBrand={companyBrand}
                setCompanyBrand={setCompanyBrand}
                setRemoveTarget={setRemoveTarget}
              />
              <BrandSeoSection
                companyBrand={companyBrand}
                setCompanyBrand={setCompanyBrand}
              />
            </div>

            <BrandPreviewAside
              brandColor={brandColor}
              careersPageTitle={careersPageTitle}
              careersPageDescription={careersPageDescription}
              companyBrand={companyBrand}
            />
          </div>
        )}

        <ConfirmationModal
          isOpen={!!removeTarget}
          onClose={() => setRemoveTarget(null)}
          onConfirm={confirmRemove}
          title={removeTarget?.type === 'team' ? 'Remove team member?' : 'Remove benefit?'}
          message={removeMessage}
          confirmText="Remove"
          type="delete"
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Company Brand" />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={BRAND_TOUR_STEPS}
          storageKey={BRAND_TOUR_KEY}
        />
      </div>
    </FeatureGate>
  );
}
