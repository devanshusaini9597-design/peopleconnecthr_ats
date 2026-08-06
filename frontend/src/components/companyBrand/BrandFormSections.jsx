import React from 'react';
import {
  Palette, Users, Sparkles, Search as SeoIcon, Plus, Trash2, Link2, Eye,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { SOCIAL_KEYS } from './companyBrandConstants';
import BrandPreview from './BrandPreview';

export function BrandIdentitySection({
  brandColor,
  setBrandColor,
  companyBrand,
  setCompanyBrand,
  careersPageTitle,
  setCareersPageTitle,
  careersPageDescription,
  setCareersPageDescription,
}) {
  return (
    <section
      data-tour="brand-identity"
      className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 space-y-4"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight inline-flex items-center gap-2">
            <Palette className="w-4 h-4 text-brand-600" /> Brand identity
          </h2>
          <p className="text-[11px] text-stone-400 mt-0.5">Color, tagline, and careers hero copy</p>
        </div>
      </div>
      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label-ats">Brand color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-11 w-14 rounded-xl border border-stone-200 bg-white p-1 cursor-pointer flex-shrink-0"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              aria-label="Brand color picker"
            />
            <input
              className="input-ats font-mono text-sm"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              placeholder="#0d9488"
            />
          </div>
        </div>
        <div>
          <label className="label-ats">Tagline</label>
          <input
            className="input-ats"
            value={companyBrand.tagline || ''}
            onChange={(e) => setCompanyBrand({ ...companyBrand, tagline: e.target.value })}
            placeholder="Short brand line"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label-ats">Careers page title</label>
          <input
            className="input-ats"
            value={careersPageTitle}
            onChange={(e) => setCareersPageTitle(e.target.value)}
            placeholder="Join our team"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label-ats">Careers description</label>
          <textarea
            className="input-ats resize-none min-h-[4.5rem]"
            rows={2}
            value={careersPageDescription}
            onChange={(e) => setCareersPageDescription(e.target.value)}
            placeholder="Why candidates should join you"
          />
        </div>
      </div>
    </section>
  );
}

export function BrandBenefitsSection({ companyBrand, setCompanyBrand, setRemoveTarget }) {
  return (
    <section className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 space-y-3">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600" /> Benefits
          </h2>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {(companyBrand.benefits || []).length} perk{(companyBrand.benefits || []).length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary !py-1.5 !text-xs w-full sm:w-auto"
          onClick={() => setCompanyBrand({
            ...companyBrand,
            benefits: [...(companyBrand.benefits || []), { title: '', description: '' }]
          })}
        >
          <Plus className="w-3.5 h-3.5" /> Add benefit
        </button>
      </div>
      {(companyBrand.benefits || []).length === 0 ? (
        <EmptyState
          icon={Sparkles}
          tone="brand"
          compact
          message="No benefits yet"
          subMessage="Add perks shown on your careers brand pack."
        />
      ) : (
        (companyBrand.benefits || []).map((b, i) => (
          <div
            key={i}
            className="relative rounded-2xl border border-stone-200/70 bg-white p-3 grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2 min-w-0"
          >
            <div>
              <label className="label-ats">Title</label>
              <input
                className="input-ats"
                placeholder="e.g. Flexible hours"
                value={b.title}
                onChange={(e) => {
                  const benefits = [...companyBrand.benefits];
                  benefits[i] = { ...b, title: e.target.value };
                  setCompanyBrand({ ...companyBrand, benefits });
                }}
              />
            </div>
            <div>
              <label className="label-ats">Description</label>
              <input
                className="input-ats"
                placeholder="Short detail"
                value={b.description}
                onChange={(e) => {
                  const benefits = [...companyBrand.benefits];
                  benefits[i] = { ...b, description: e.target.value };
                  setCompanyBrand({ ...companyBrand, benefits });
                }}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white px-2.5 py-2.5 text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 w-full sm:w-auto transition-colors"
                onClick={() => setRemoveTarget({ type: 'benefit', index: i })}
                aria-label="Remove benefit"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export function BrandTeamSection({ companyBrand, setCompanyBrand, setRemoveTarget }) {
  return (
    <section className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 space-y-3">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight inline-flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" /> Team members
          </h2>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {(companyBrand.teamMembers || []).length} member{(companyBrand.teamMembers || []).length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary !py-1.5 !text-xs w-full sm:w-auto"
          onClick={() => setCompanyBrand({
            ...companyBrand,
            teamMembers: [...(companyBrand.teamMembers || []), { name: '', role: '', bio: '' }]
          })}
        >
          <Plus className="w-3.5 h-3.5" /> Add member
        </button>
      </div>
      {(companyBrand.teamMembers || []).length === 0 ? (
        <EmptyState
          icon={Users}
          tone="brand"
          compact
          message="No team members"
          subMessage="Optional faces for your careers brand story."
        />
      ) : (
        (companyBrand.teamMembers || []).map((m, i) => (
          <div
            key={i}
            className="rounded-2xl border border-stone-200/70 bg-white p-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            <div>
              <label className="label-ats">Name</label>
              <input
                className="input-ats"
                value={m.name || ''}
                onChange={(e) => {
                  const teamMembers = [...companyBrand.teamMembers];
                  teamMembers[i] = { ...m, name: e.target.value };
                  setCompanyBrand({ ...companyBrand, teamMembers });
                }}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="label-ats">Role</label>
              <input
                className="input-ats"
                value={m.role || ''}
                onChange={(e) => {
                  const teamMembers = [...companyBrand.teamMembers];
                  teamMembers[i] = { ...m, role: e.target.value };
                  setCompanyBrand({ ...companyBrand, teamMembers });
                }}
                placeholder="Title"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Bio</label>
              <input
                className="input-ats"
                value={m.bio || ''}
                onChange={(e) => {
                  const teamMembers = [...companyBrand.teamMembers];
                  teamMembers[i] = { ...m, bio: e.target.value };
                  setCompanyBrand({ ...companyBrand, teamMembers });
                }}
                placeholder="One-line bio"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-stone-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                onClick={() => setRemoveTarget({ type: 'team', index: i })}
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove member
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export function BrandSeoSection({ companyBrand, setCompanyBrand }) {
  return (
    <section className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 space-y-3">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative">
        <h2 className="text-[15px] font-bold text-stone-900 tracking-tight inline-flex items-center gap-2">
          <SeoIcon className="w-4 h-4 text-brand-600" /> SEO & social
        </h2>
        <p className="text-[11px] text-stone-400 mt-0.5">Discoverability and profile links</p>
      </div>
      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label-ats">SEO title</label>
          <input
            className="input-ats"
            value={companyBrand.seoTitle || ''}
            onChange={(e) => setCompanyBrand({ ...companyBrand, seoTitle: e.target.value })}
            placeholder="Careers at Acme"
          />
        </div>
        <div>
          <label className="label-ats">SEO description</label>
          <input
            className="input-ats"
            value={companyBrand.seoDescription || ''}
            onChange={(e) => setCompanyBrand({ ...companyBrand, seoDescription: e.target.value })}
            placeholder="Meta description for search"
          />
        </div>
        {SOCIAL_KEYS.map(({ key, label }) => (
          <div key={key}>
            <label className="label-ats inline-flex items-center gap-1.5">
              <Link2 className="w-3 h-3 text-stone-400" /> {label}
            </label>
            <input
              className="input-ats"
              value={companyBrand.socialLinks?.[key] || ''}
              onChange={(e) => setCompanyBrand({
                ...companyBrand,
                socialLinks: { ...companyBrand.socialLinks, [key]: e.target.value }
              })}
              placeholder="https://"
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label className="label-ats">Custom CSS (advanced)</label>
          <textarea
            className="input-ats resize-y font-mono text-xs min-h-[6rem]"
            rows={4}
            value={companyBrand.customCss || ''}
            onChange={(e) => setCompanyBrand({ ...companyBrand, customCss: e.target.value })}
            placeholder="/* Optional careers page overrides */"
          />
        </div>
      </div>
    </section>
  );
}

export function BrandPreviewAside({
  brandColor,
  careersPageTitle,
  careersPageDescription,
  companyBrand,
}) {
  return (
    <aside
      data-tour="brand-preview"
      className="xl:col-span-4 min-w-0 xl:sticky xl:top-4"
    >
      <div className="card-ats-bordered relative overflow-hidden min-h-[28rem] flex flex-col">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Live preview</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">Careers brand mock</p>
          </div>
          <span className="badge-neutral text-[10px] flex-shrink-0 inline-flex items-center gap-1">
            <Eye className="w-3 h-3" /> Preview
          </span>
        </div>
        <div className="relative flex-1 p-3.5 sm:p-4 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_48%)]">
          <BrandPreview
            brandColor={brandColor}
            careersPageTitle={careersPageTitle}
            careersPageDescription={careersPageDescription}
            companyBrand={companyBrand}
          />
        </div>
      </div>
    </aside>
  );
}
