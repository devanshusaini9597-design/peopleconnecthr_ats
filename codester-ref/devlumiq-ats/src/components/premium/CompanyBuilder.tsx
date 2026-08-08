'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Image as ImageIcon, Sparkles, Users, Link2, Globe,
  Plus, Trash2, Save, Check, Loader2, ChevronRight,
  AlertCircle, ExternalLink, Eye, Heart,
  Twitter, Linkedin, Github, Facebook, Instagram, Youtube,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Benefit  { id?: string; icon: string; title: string; description: string; sortOrder?: number }
interface TeamMember { id?: string; name: string; role: string; photoUrl: string; bio: string; sortOrder?: number }
interface SocialLink { id?: string; platform: string; url: string; sortOrder?: number }

interface CompanyData {
  name: string; slug: string; description: string; website: string;
  logoUrl: string; faviconUrl: string;
  primaryColor: string; secondaryColor: string; accentColor: string;
  fontFamily: string;
  heroTitle: string; heroSubtitle: string; heroBackground: string;
  showBenefits: boolean; showTeamPhotos: boolean; isPublished: boolean;
  metaTitle: string; metaDescription: string;
  twitterHandle: string; linkedinUrl: string;
  benefits: Benefit[]; teamMembers: TeamMember[]; socialLinks: SocialLink[];
}

/* ── Constants ───────────────────────────────────────────────────────── */
const EMPTY: CompanyData = {
  name: '', slug: '', description: '', website: '',
  logoUrl: '', faviconUrl: '',
  primaryColor: '#0d9488', secondaryColor: '#14b8a6', accentColor: '#5eead4',
  fontFamily: 'inter',
  heroTitle: 'Join Our Team', heroSubtitle: '', heroBackground: '',
  showBenefits: true, showTeamPhotos: false, isPublished: false,
  metaTitle: '', metaDescription: '',
  twitterHandle: '', linkedinUrl: '',
  benefits: [], teamMembers: [], socialLinks: [],
};

const TABS = [
  { id: 'brand',    label: 'Brand',      icon: Building2 },
  { id: 'hero',     label: 'Hero',       icon: Sparkles },
  { id: 'benefits', label: 'Benefits',   icon: Heart },
  { id: 'team',     label: 'Team',       icon: Users },
  { id: 'social',   label: 'Social',     icon: Link2 },
  { id: 'seo',      label: 'SEO',        icon: Globe },
] as const;
type TabId = (typeof TABS)[number]['id'];

const SOCIAL_PLATFORMS = ['LinkedIn', 'Twitter', 'GitHub', 'Facebook', 'Instagram', 'YouTube', 'Website', 'Other'];
const SOCIAL_ICONS: Record<string, React.ElementType> = {
  LinkedIn: Linkedin, Twitter: Twitter, GitHub: Github,
  Facebook: Facebook, Instagram: Instagram, YouTube: Youtube, Website: Globe, Other: Link2,
};

const BENEFIT_ICONS = ['💰', '🏥', '🏖️', '📚', '🏋️', '🍕', '🎮', '🚀', '💻', '🌍', '🎯', '⚡', '🤝', '🎓', '🛡️', '🏠'];
const FONT_OPTIONS = [
  { id: 'inter', label: 'Inter (Modern)' },
  { id: 'georgia', label: 'Georgia (Classic)' },
  { id: 'mono', label: 'Monospace (Tech)' },
];

/* ── Shared UI helpers ─────────────────────────────────────────────────── */
const inputCls = 'w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-500/15 focus:border-brand-500 outline-none font-medium text-stone-900 transition-all placeholder:text-stone-400';
const labelCls = 'block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function SectionHead({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-stone-100">
      <div className="p-2 rounded-xl bg-stone-100">{icon}</div>
      <div>
        <h3 className="text-sm font-bold text-stone-900">{title}</h3>
        {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-100/60 transition-colors">
      <label htmlFor={id} className="text-sm font-semibold text-stone-800 cursor-pointer select-none flex-1">{label}</label>
      <button
        id={id}
        type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-brand-500' : 'bg-stone-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */
export default function CompanyBuilder() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('brand');
  const [data, setData] = useState<CompanyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadErr, setLoadErr] = useState('');

  /* ── Load existing company data ─────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/company', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json?.id) {
          setData({
            ...EMPTY, ...json,
            benefits:    json.benefits    ?? [],
            teamMembers: json.teamMembers ?? [],
            socialLinks: json.socialLinks ?? [],
          });
        }
      })
      .catch(() => setLoadErr('Could not load company data. You can still fill in the form and save.'))
      .finally(() => setLoading(false));
  }, []);

  /* ── Helpers ────────────────────────────────────────────────────────── */
  const set = useCallback(<K extends keyof CompanyData>(key: K, value: CompanyData[K]) =>
    setData((prev) => ({ ...prev, [key]: value })), []);

  const toSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* ── Save ───────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!data.name.trim()) { toast.error('Validation', 'Company name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data, slug: data.slug || toSlug(data.name) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error('Save failed', json?.error ?? 'Unexpected error'); return; }
      setData((prev) => ({ ...prev, ...json, benefits: json.benefits ?? prev.benefits, teamMembers: json.teamMembers ?? prev.teamMembers, socialLinks: json.socialLinks ?? prev.socialLinks }));
      setSaved(true);
      toast.success('Company saved!', 'Your careers page has been updated.');
      setTimeout(() => setSaved(false), 3500);
    } catch { toast.error('Save failed', 'Network error. Please try again.'); }
    finally { setSaving(false); }
  };

  /* ── Benefits helpers ───────────────────────────────────────────────── */
  const addBenefit = () => setData((p) => ({ ...p, benefits: [...p.benefits, { icon: '🚀', title: '', description: '', sortOrder: p.benefits.length }] }));
  const removeBenefit = (idx: number) => setData((p) => ({ ...p, benefits: p.benefits.filter((_, i) => i !== idx) }));
  const setBenefit = (idx: number, field: keyof Benefit, value: string) =>
    setData((p) => ({ ...p, benefits: p.benefits.map((b, i) => i === idx ? { ...b, [field]: value } : b) }));

  /* ── Team helpers ───────────────────────────────────────────────────── */
  const addMember = () => setData((p) => ({ ...p, teamMembers: [...p.teamMembers, { name: '', role: '', photoUrl: '', bio: '', sortOrder: p.teamMembers.length }] }));
  const removeMember = (idx: number) => setData((p) => ({ ...p, teamMembers: p.teamMembers.filter((_, i) => i !== idx) }));
  const setMember = (idx: number, field: keyof TeamMember, value: string) =>
    setData((p) => ({ ...p, teamMembers: p.teamMembers.map((m, i) => i === idx ? { ...m, [field]: value } : m) }));

  /* ── Social helpers ─────────────────────────────────────────────────── */
  const addSocial = () => setData((p) => ({ ...p, socialLinks: [...p.socialLinks, { platform: 'LinkedIn', url: '', sortOrder: p.socialLinks.length }] }));
  const removeSocial = (idx: number) => setData((p) => ({ ...p, socialLinks: p.socialLinks.filter((_, i) => i !== idx) }));
  const setSocial = (idx: number, field: keyof SocialLink, value: string) =>
    setData((p) => ({ ...p, socialLinks: p.socialLinks.map((s, i) => i === idx ? { ...s, [field]: value } : s) }));

  /* ── Loading state ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 text-brand-500 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading company settings…</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        icon={Building2}
        title="Company Builder"
        subtitle="Customize your public careers page"
      >
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/careers"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary !px-4 !py-2.5 !text-sm inline-flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Preview Page
            <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
          </a>
          <motion.button
            type="button" onClick={handleSave} disabled={saving}
            whileHover={{ scale: saving ? 1 : 1.015 }} whileTap={{ scale: 0.97 }}
            className={`inline-flex items-center gap-2 !px-5 !py-2.5 !text-sm font-bold transition-all ${
              saved
                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300 rounded-xl shadow-emerald-100'
                : 'btn-primary disabled:opacity-70'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save & Publish'}
          </motion.button>
        </div>
      </PageHeader>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {loadErr && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{loadErr}</p>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6">
        {/* ── Tab sidebar ──────────────────────────────────────────────── */}
        <aside className="xl:w-48 flex-shrink-0">
          <nav className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-[var(--shadow-card,0_2px_12px_rgba(0,0,0,.06))]">
            {TABS.map((tb, idx) => {
              const Icon = tb.icon;
              const active = activeTab === tb.id;
              return (
                <button
                  key={tb.id} type="button" onClick={() => setActiveTab(tb.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-all ${
                    idx !== TABS.length - 1 ? 'border-b border-stone-100' : ''
                  } ${active ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-brand-600' : 'text-stone-400'}`} />
                  <span className="flex-1 text-left">{tb.label}</span>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-brand-400" />}
                </button>
              );
            })}
          </nav>

          {/* Publish toggle */}
          <div className="mt-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[var(--shadow-card,0_2px_12px_rgba(0,0,0,.06))]">
            <Toggle
              label={data.isPublished ? '🟢 Published' : '⚪ Draft'}
              checked={data.isPublished}
              onChange={(v) => set('isPublished', v)}
            />
            <p className="text-[11px] text-stone-400 mt-2 text-center">
              {data.isPublished ? 'Careers page is live' : 'Save to publish your page'}
            </p>
          </div>
        </aside>

        {/* ── Tab content ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.16 }}
              className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card,0_2px_12px_rgba(0,0,0,.06))]"
            >

              {/* ── BRAND TAB ─────────────────────────────────────────── */}
              {activeTab === 'brand' && (
                <div className="space-y-6">
                  <SectionHead
                    icon={<Building2 className="w-4 h-4 text-brand-600" />}
                    title="Brand Identity"
                    subtitle="Company basics shown across the platform and careers page"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label="Company Name *">
                      <input
                        type="text" value={data.name} placeholder="Devlumiq"
                        onChange={(e) => { set('name', e.target.value); if (!data.slug) set('slug', toSlug(e.target.value)); }}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Slug (URL)">
                      <div className="flex rounded-xl border border-stone-200 overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/15 focus-within:border-brand-500 bg-stone-50/50">
                        <span className="flex-shrink-0 px-3 flex items-center text-xs text-stone-400 font-mono bg-stone-100 border-r border-stone-200">/careers/</span>
                        <input
                          type="text" value={data.slug} placeholder="devlumiq"
                          onChange={(e) => set('slug', e.target.value)}
                          className="flex-1 px-3 py-3 bg-transparent outline-none font-mono text-sm text-stone-900"
                        />
                        <button
                          type="button" title="Auto-generate from name"
                          onClick={() => set('slug', toSlug(data.name))}
                          className="px-3 flex items-center text-stone-400 hover:text-brand-600 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </Field>
                  </div>

                  <Field label="Description">
                    <textarea
                      value={data.description} placeholder="What does your company do? (shown on careers page)"
                      rows={3} onChange={(e) => set('description', e.target.value)}
                      className={`${inputCls} resize-none`}
                    />
                  </Field>

                  <Field label="Website URL">
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                      <input type="url" value={data.website} placeholder="https://yourcompany.com" onChange={(e) => set('website', e.target.value)} className={`pl-11 ${inputCls}`} />
                    </div>
                  </Field>

                  <Field label="Logo URL">
                    <div className="relative">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                      <input type="url" value={data.logoUrl} placeholder="https://yourcdn.com/logo.png" onChange={(e) => set('logoUrl', e.target.value)} className={`pl-11 ${inputCls}`} />
                    </div>
                    {data.logoUrl && (
                      <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={data.logoUrl} alt="Logo preview" className="h-10 w-auto object-contain rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        <span className="text-xs text-stone-500">Logo preview</span>
                      </div>
                    )}
                  </Field>

                  {/* Colors */}
                  <div>
                    <label className={labelCls}>Brand Colors</label>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { key: 'primaryColor', label: 'Primary' },
                        { key: 'secondaryColor', label: 'Secondary' },
                        { key: 'accentColor', label: 'Accent' },
                      ] as const).map(({ key, label }) => (
                        <div key={key} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-stone-200 bg-stone-50/50">
                          <input
                            type="color" value={data[key]}
                            onChange={(e) => set(key, e.target.value)}
                            className="w-10 h-10 rounded-lg cursor-pointer border-2 border-stone-200 bg-transparent p-0.5"
                          />
                          <span className="text-xs font-semibold text-stone-600">{label}</span>
                          <span className="text-[10px] font-mono text-stone-400">{data[key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Font */}
                  <Field label="Font Family">
                    <select value={data.fontFamily} onChange={(e) => set('fontFamily', e.target.value)} className={inputCls}>
                      {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {/* ── HERO TAB ──────────────────────────────────────────── */}
              {activeTab === 'hero' && (
                <div className="space-y-6">
                  <SectionHead
                    icon={<Sparkles className="w-4 h-4 text-amber-500" />}
                    title="Hero Section"
                    subtitle="The first thing visitors see on your careers page"
                  />

                  <Field label="Hero Title">
                    <input type="text" value={data.heroTitle} placeholder="Join Our Team" onChange={(e) => set('heroTitle', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Hero Subtitle">
                    <textarea value={data.heroSubtitle} placeholder="We're building the future — and we want you on the team." rows={3} onChange={(e) => set('heroSubtitle', e.target.value)} className={`${inputCls} resize-none`} />
                  </Field>
                  <Field label="Hero Background Color / Gradient">
                    <div className="flex gap-3 items-center">
                      <input type="color" value={data.heroBackground || data.primaryColor} onChange={(e) => set('heroBackground', e.target.value)} className="w-12 h-12 rounded-xl border-2 border-stone-200 cursor-pointer p-1" />
                      <input type="text" value={data.heroBackground} placeholder="e.g. #0d9488 or leave blank for gradient" onChange={(e) => set('heroBackground', e.target.value)} className={`flex-1 ${inputCls}`} />
                    </div>
                  </Field>

                  {/* Live preview */}
                  <div>
                    <label className={labelCls}>Live Preview</label>
                    <div
                      className="rounded-2xl overflow-hidden border border-stone-200 shadow-md"
                      style={{ background: data.heroBackground || `linear-gradient(135deg, ${data.primaryColor}, ${data.secondaryColor})` }}
                    >
                      <div className="p-8 text-white text-center">
                        {data.logoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={data.logoUrl} alt="logo" className="h-10 mx-auto mb-4 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        )}
                        <h2 className="text-2xl font-extrabold drop-shadow">{data.heroTitle || 'Join Our Team'}</h2>
                        {data.heroSubtitle && <p className="mt-2 text-sm opacity-90 max-w-sm mx-auto">{data.heroSubtitle}</p>}
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-sm font-semibold backdrop-blur-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          {data.name || 'Your Company'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Toggle label="Show Benefits Section" checked={data.showBenefits} onChange={(v) => set('showBenefits', v)} />
                    <Toggle label="Show Team Photos" checked={data.showTeamPhotos} onChange={(v) => set('showTeamPhotos', v)} />
                  </div>
                </div>
              )}

              {/* ── BENEFITS TAB ──────────────────────────────────────── */}
              {activeTab === 'benefits' && (
                <div className="space-y-5">
                  <SectionHead
                    icon={<Heart className="w-4 h-4 text-rose-500" />}
                    title="Company Benefits"
                    subtitle="Highlight what makes working at your company great"
                  />

                  {data.benefits.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-stone-200 rounded-2xl">
                      <Heart className="w-10 h-10 text-stone-300 mb-3" />
                      <p className="text-sm font-semibold text-stone-500">No benefits added yet</p>
                      <p className="text-xs text-stone-400 mt-1">Add perks to attract top talent</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <AnimatePresence>
                      {data.benefits.map((b, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8, height: 0 }}
                          className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1 block">Icon</label>
                                <select value={b.icon} onChange={(e) => setBenefit(idx, 'icon', e.target.value)} className={`${inputCls} text-lg`}>
                                  {BENEFIT_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                                </select>
                              </div>
                              <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1 block">Title</label>
                                <input type="text" value={b.title} placeholder="e.g. Health Insurance" onChange={(e) => setBenefit(idx, 'title', e.target.value)} className={inputCls} />
                              </div>
                            </div>
                            <button type="button" onClick={() => removeBenefit(idx)} className="flex-shrink-0 mt-5 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1 block">Description</label>
                            <input type="text" value={b.description} placeholder="Brief description of this benefit" onChange={(e) => setBenefit(idx, 'description', e.target.value)} className={inputCls} />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <button
                    type="button" onClick={addBenefit}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 font-semibold text-sm hover:bg-brand-50 hover:border-brand-400 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Benefit
                  </button>
                </div>
              )}

              {/* ── TEAM TAB ──────────────────────────────────────────── */}
              {activeTab === 'team' && (
                <div className="space-y-5">
                  <SectionHead
                    icon={<Users className="w-4 h-4 text-teal-600" />}
                    title="Team Members"
                    subtitle="Add the people that represent your company"
                  />

                  {data.teamMembers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-stone-200 rounded-2xl">
                      <Users className="w-10 h-10 text-stone-300 mb-3" />
                      <p className="text-sm font-semibold text-stone-500">No team members added yet</p>
                      <p className="text-xs text-stone-400 mt-1">People make your culture real — add your team</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <AnimatePresence>
                      {data.teamMembers.map((m, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-3"
                        >
                          <div className="flex items-start gap-3">
                            {/* Avatar preview */}
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 border-stone-200 bg-stone-100 flex items-center justify-center text-stone-400">
                              {m.photoUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                : <Users className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1 block">Name</label>
                                <input type="text" value={m.name} placeholder="Sarah Chen" onChange={(e) => setMember(idx, 'name', e.target.value)} className={inputCls} />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1 block">Role / Title</label>
                                <input type="text" value={m.role} placeholder="Head of Engineering" onChange={(e) => setMember(idx, 'role', e.target.value)} className={inputCls} />
                              </div>
                            </div>
                            <button type="button" onClick={() => removeMember(idx)} className="flex-shrink-0 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1 block">Photo URL</label>
                            <input type="url" value={m.photoUrl} placeholder="https://photos.yourcompany.com/sarah.jpg" onChange={(e) => setMember(idx, 'photoUrl', e.target.value)} className={inputCls} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1 block">Short Bio</label>
                            <input type="text" value={m.bio} placeholder="10+ years building great products..." onChange={(e) => setMember(idx, 'bio', e.target.value)} className={inputCls} />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <button
                    type="button" onClick={addMember}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-teal-300 text-teal-600 font-semibold text-sm hover:bg-teal-50 hover:border-teal-400 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Team Member
                  </button>
                </div>
              )}

              {/* ── SOCIAL TAB ────────────────────────────────────────── */}
              {activeTab === 'social' && (
                <div className="space-y-5">
                  <SectionHead
                    icon={<Link2 className="w-4 h-4 text-violet-500" />}
                    title="Social Links"
                    subtitle="Connect your company profiles to the careers page"
                  />

                  {data.socialLinks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-stone-200 rounded-2xl">
                      <Link2 className="w-10 h-10 text-stone-300 mb-3" />
                      <p className="text-sm font-semibold text-stone-500">No social links added yet</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <AnimatePresence>
                      {data.socialLinks.map((s, idx) => {
                        const Icon = SOCIAL_ICONS[s.platform] ?? Link2;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="flex items-center gap-3"
                          >
                            <div className="flex-shrink-0 p-2.5 rounded-xl bg-stone-100 text-stone-500">
                              <Icon className="w-4 h-4" />
                            </div>
                            <select
                              value={s.platform}
                              onChange={(e) => setSocial(idx, 'platform', e.target.value)}
                              className="flex-shrink-0 px-3 py-3 rounded-xl border border-stone-200 bg-stone-50/50 font-medium text-stone-900 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                            >
                              {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input
                              type="url" value={s.url}
                              placeholder="https://linkedin.com/company/yourcompany"
                              onChange={(e) => setSocial(idx, 'url', e.target.value)}
                              className={`flex-1 ${inputCls}`}
                            />
                            <button type="button" onClick={() => removeSocial(idx)} className="flex-shrink-0 p-2.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  <button
                    type="button" onClick={addSocial}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-violet-300 text-violet-600 font-semibold text-sm hover:bg-violet-50 hover:border-violet-400 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Social Link
                  </button>
                </div>
              )}

              {/* ── SEO TAB ───────────────────────────────────────────── */}
              {activeTab === 'seo' && (
                <div className="space-y-6">
                  <SectionHead
                    icon={<Globe className="w-4 h-4 text-emerald-600" />}
                    title="SEO & Sharing"
                    subtitle="Optimize how your careers page appears in search results"
                  />

                  <Field label="Meta Title">
                    <input type="text" value={data.metaTitle ?? ''} placeholder="Careers at Devlumiq — Join Our Team" onChange={(e) => set('metaTitle', e.target.value)} className={inputCls} />
                    <p className="text-[11px] text-stone-400 mt-1">{(data.metaTitle ?? '').length} / 60 characters</p>
                  </Field>

                  <Field label="Meta Description">
                    <textarea
                      value={data.metaDescription ?? ''}
                      placeholder="We're a fast-growing startup looking for talented people to join our mission…"
                      rows={3} onChange={(e) => set('metaDescription', e.target.value)}
                      className={`${inputCls} resize-none`}
                    />
                    <p className="text-[11px] text-stone-400 mt-1">{(data.metaDescription ?? '').length} / 160 characters</p>
                  </Field>

                  <Field label="Twitter / X Handle">
                    <div className="relative">
                      <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                      <input type="text" value={data.twitterHandle ?? ''} placeholder="@devlumiq" onChange={(e) => set('twitterHandle', e.target.value)} className={`pl-11 ${inputCls}`} />
                    </div>
                  </Field>

                  <Field label="LinkedIn Company URL">
                    <div className="relative">
                      <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                      <input type="url" value={data.linkedinUrl ?? ''} placeholder="https://linkedin.com/company/devlumiq" onChange={(e) => set('linkedinUrl', e.target.value)} className={`pl-11 ${inputCls}`} />
                    </div>
                  </Field>

                  {/* SEO preview */}
                  <div>
                    <label className={labelCls}>Search Preview</label>
                    <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
                      <p className="text-blue-600 text-sm font-medium underline truncate">{typeof window !== 'undefined' ? `${window.location.origin}/careers` : 'https://yoursite.com/careers'}</p>
                      <p className="text-base font-semibold text-stone-900 leading-snug mt-0.5 truncate">{data.metaTitle || `Careers at ${data.name || 'Your Company'}`}</p>
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">{data.metaDescription || data.description || 'We are hiring — come build with us.'}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom save bar ──────────────────────────────────────────── */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card,0_2px_12px_rgba(0,0,0,.06))]">
        <div className="flex items-center gap-3 text-sm text-stone-500">
          <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          Changes save to your live careers page at{' '}
          <a href="/careers" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-semibold">
            /careers ↗
          </a>
        </div>
        <motion.button
          type="button" onClick={handleSave} disabled={saving}
          whileHover={{ scale: saving ? 1 : 1.015 }} whileTap={{ scale: 0.97 }}
          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
            saved
              ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300'
              : 'bg-gradient-to-r from-brand-600 to-teal-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 disabled:opacity-70'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save & Publish'}
        </motion.button>
      </div>
    </PageShell>
  );
}
