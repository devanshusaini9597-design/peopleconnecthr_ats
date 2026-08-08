'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Palette, Globe, Image, Share2, 
  Users, Gift, Eye, Save, CheckCircle, Loader2,
  ExternalLink, Sparkles, X
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';

interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  twitterHandle: string;
  linkedinUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBackground: string;
  showBenefits: boolean;
  showTeamPhotos: boolean;
  customDomain: string;
  enableLinkedInShare: boolean;
  enableTwitterShare: boolean;
  enableFacebookShare: boolean;
  enableEmailShare: boolean;
  isPublished: boolean;
  benefits: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
  }>;
  teamMembers: Array<{
    id: string;
    name: string;
    role: string;
    photoUrl: string;
    bio: string;
  }>;
  socialLinks: Array<{
    id: string;
    platform: string;
    url: string;
  }>;
}

export default function CompanyBuilder() {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('branding');
  const toast = useToast();

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      const res = await fetch('/api/company');
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
      } else if (res.status === 404) {
        // No company yet - initialize with defaults
        setCompany({
          id: '',
          name: '',
          slug: '',
          description: '',
          website: '',
          logoUrl: '',
          faviconUrl: '',
          primaryColor: '#0d9488',
          secondaryColor: '#14b8a6',
          accentColor: '#5eead4',
          fontFamily: 'inter',
          metaTitle: '',
          metaDescription: '',
          ogImageUrl: '',
          twitterHandle: '',
          linkedinUrl: '',
          heroTitle: 'Join Our Team',
          heroSubtitle: '',
          heroBackground: '',
          showBenefits: true,
          showTeamPhotos: false,
          customDomain: '',
          enableLinkedInShare: true,
          enableTwitterShare: true,
          enableFacebookShare: false,
          enableEmailShare: true,
          isPublished: false,
          benefits: [],
          teamMembers: [],
          socialLinks: [],
        });
      }
    } catch (error) {
      console.error('Error fetching company:', error);
      toast.error('Failed to load company data');
    } finally {
      setLoading(false);
    }
  };

  const saveCompany = async () => {
    if (!company) return;
    if (!company.name || !company.slug) {
      toast.warning('Please fill in Company Name and Slug');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      });
      if (res.ok) {
        const updated = await res.json();
        if (updated.id) setCompany({ ...company, id: updated.id });
        toast.success('Company profile saved', 'All changes have been saved');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to save company');
      }
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error('Failed to save company profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse p-4 sm:p-6">
      <div className="h-8 bg-stone-200 rounded-xl w-48" />
      <div className="h-4 bg-stone-100 rounded w-32" />
      <div className="h-12 bg-stone-100 rounded-xl" />
      <div className="h-64 bg-stone-100 rounded-2xl" />
    </div>
  );

  const tabs = [
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'content', label: 'Content', icon: Building2 },
    { id: 'seo', label: 'SEO & Social', icon: Globe },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'benefits', label: 'Benefits', icon: Gift },
    { id: 'preview', label: 'Preview', icon: Eye },
  ];

  return (
    <PageShell>
      <PageHeader
        icon={Building2}
        title="Career Page Builder"
        subtitle="Customize your branded career page"
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {company?.slug && (
            <a
              href={`/careers/${company.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !px-3 !py-2.5 !text-sm inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Preview Page</span>
            </a>
          )}
          {/* Published toggle */}
          <button
            onClick={() => setCompany(company ? { ...company, isPublished: !company.isPublished } : company)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              company?.isPublished
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${company?.isPublished ? 'bg-emerald-500' : 'bg-stone-400'}`} />
            {company?.isPublished ? 'Published' : 'Draft'}
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveCompany}
            disabled={saving}
            className="btn-primary !px-4 !py-2.5 !text-sm disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4" /> <span className="hidden sm:inline">Save Changes</span><span className="sm:hidden">Save</span></>
            )}
          </motion.button>
        </div>
      </PageHeader>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide border-b border-stone-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600 bg-brand-50/50'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-brand-500' : 'text-stone-400'}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* ── Tab Content ──────────────────────────────────────────────── */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-4 sm:p-6"
        >
          {activeTab === 'branding' && <BrandingTab company={company} setCompany={setCompany} />}
          {activeTab === 'content' && <ContentTab company={company} setCompany={setCompany} />}
          {activeTab === 'seo' && <SEOTab company={company} setCompany={setCompany} />}
          {activeTab === 'team' && <TeamTab company={company} setCompany={setCompany} />}
          {activeTab === 'benefits' && <BenefitsTab company={company} setCompany={setCompany} />}
          {activeTab === 'preview' && <PreviewTab company={company} />}
        </motion.div>
      </div>
    </PageShell>
  );
}

function BrandingTab({ company, setCompany }: { company: any; setCompany: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-stone-900 mb-1">Brand Identity</h3>
        <p className="text-sm text-stone-500">Customize your career page colors, fonts and logo</p>
      </div>
      <h4 className="font-semibold text-stone-800">Brand Colors</h4>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Primary Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={company?.primaryColor || '#0d9488'}
              onChange={(e) => setCompany({ ...company, primaryColor: e.target.value })}
              className="w-12 h-12 rounded-lg border border-stone-200 cursor-pointer"
            />
            <input
              type="text"
              value={company?.primaryColor || '#0d9488'}
              onChange={(e) => setCompany({ ...company, primaryColor: e.target.value })}
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Secondary Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={company?.secondaryColor || '#14b8a6'}
              onChange={(e) => setCompany({ ...company, secondaryColor: e.target.value })}
              className="w-12 h-12 rounded-lg border border-stone-200 cursor-pointer"
            />
            <input
              type="text"
              value={company?.secondaryColor || '#14b8a6'}
              onChange={(e) => setCompany({ ...company, secondaryColor: e.target.value })}
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={company?.accentColor || '#5eead4'}
              onChange={(e) => setCompany({ ...company, accentColor: e.target.value })}
              className="w-12 h-12 rounded-lg border border-stone-200 cursor-pointer"
            />
            <input
              type="text"
              value={company?.accentColor || '#5eead4'}
              onChange={(e) => setCompany({ ...company, accentColor: e.target.value })}
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          Font Family
        </label>
        <select
          value={company?.fontFamily || 'inter'}
          onChange={(e) => setCompany({ ...company, fontFamily: e.target.value })}
          className="w-full px-3 py-2 border border-stone-200 rounded-lg"
        >
          <option value="inter">Inter (Modern)</option>
          <option value="roboto">Roboto (Clean)</option>
          <option value="poppins">Poppins (Friendly)</option>
          <option value="playfair">Playfair (Elegant)</option>
          <option value="montserrat">Montserrat (Bold)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Company Logo URL
          </label>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-stone-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {company?.logoUrl ? (
                <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Image className="w-5 h-5 sm:w-6 sm:h-6 text-stone-400" />
              )}
            </div>
            <input
              type="url"
              value={company?.logoUrl || ''}
              onChange={(e) => setCompany({ ...company, logoUrl: e.target.value })}
              placeholder="https://..."
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Favicon URL
          </label>
          <input
            type="url"
            value={company?.faviconUrl || ''}
            onChange={(e) => setCompany({ ...company, faviconUrl: e.target.value })}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function ContentTab({ company, setCompany }: { company: any; setCompany: any }) {
  const inputCls = 'w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all';
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-stone-900 mb-1">Page Content</h3>
        <p className="text-sm text-stone-500">Configure your career page content and hero section</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Company Name *</label>
          <input type="text" value={company?.name || ''} onChange={(e) => setCompany({ ...company, name: e.target.value })} className={inputCls} placeholder="Your Company" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">URL Slug *</label>
          <input type="text" value={company?.slug || ''} onChange={(e) => setCompany({ ...company, slug: e.target.value })} className={inputCls} placeholder="your-company" />
          <p className="text-xs text-stone-400 mt-1">yoursite.com/careers/<span className="font-medium text-brand-600">{company?.slug || 'your-company'}</span></p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">Company Description</label>
        <textarea value={company?.description || ''} onChange={(e) => setCompany({ ...company, description: e.target.value })} rows={4} className={inputCls + ' resize-none'} placeholder="Tell candidates about your company culture, mission, and values..." />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">Website URL</label>
        <input type="url" value={company?.website || ''} onChange={(e) => setCompany({ ...company, website: e.target.value })} className={inputCls} placeholder="https://yourcompany.com" />
      </div>

      <div className="p-5 rounded-xl bg-gradient-to-br from-brand-50/50 to-teal-50/50 border border-brand-100 space-y-4">
        <h4 className="font-semibold text-stone-800">Hero Section</h4>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Hero Title</label>
          <input type="text" value={company?.heroTitle || 'Join Our Team'} onChange={(e) => setCompany({ ...company, heroTitle: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Hero Subtitle</label>
          <textarea value={company?.heroSubtitle || ''} onChange={(e) => setCompany({ ...company, heroSubtitle: e.target.value })} rows={2} className={inputCls + ' resize-none'} placeholder="Discover exciting career opportunities..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Background Image URL</label>
          <input type="url" value={company?.heroBackground || ''} onChange={(e) => setCompany({ ...company, heroBackground: e.target.value })} placeholder="https://..." className={inputCls} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl bg-stone-50 border border-stone-200">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={company?.showBenefits ?? true} onChange={(e) => setCompany({ ...company, showBenefits: e.target.checked })} className="w-4 h-4 text-brand-600 rounded" />
          <span className="text-sm text-stone-700 font-medium">Show Benefits Section</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={company?.showTeamPhotos ?? false} onChange={(e) => setCompany({ ...company, showTeamPhotos: e.target.checked })} className="w-4 h-4 text-brand-600 rounded" />
          <span className="text-sm text-stone-700 font-medium">Show Team Photos</span>
        </label>
      </div>
    </div>
  );
}

function SEOTab({ company, setCompany }: { company: any; setCompany: any }) {
  const inputCls = 'w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all';
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-stone-900 mb-1">SEO Settings</h3>
        <p className="text-sm text-stone-500">Optimize your career page for search engines</p>
      </div>

      <div className="p-5 rounded-xl bg-stone-50 border border-stone-200 space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Meta Title</label>
          <input type="text" value={company?.metaTitle || ''} onChange={(e) => setCompany({ ...company, metaTitle: e.target.value })} placeholder="Careers at Company Name" className={inputCls} />
          <p className="text-xs text-stone-400 mt-1">{(company?.metaTitle || '').length}/60 characters recommended</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Meta Description</label>
          <textarea value={company?.metaDescription || ''} onChange={(e) => setCompany({ ...company, metaDescription: e.target.value })} rows={3} className={inputCls + ' resize-none'} placeholder="Discover career opportunities at our company..." />
          <p className="text-xs text-stone-400 mt-1">{(company?.metaDescription || '').length}/160 characters recommended</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">OG Image URL</label>
          <input type="url" value={company?.ogImageUrl || ''} onChange={(e) => setCompany({ ...company, ogImageUrl: e.target.value })} className={inputCls} placeholder="https://..." />
          <p className="text-xs text-stone-400 mt-1">Recommended: 1200x630px</p>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-stone-800 mb-4">Social Profiles</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Twitter Handle</label>
            <input type="text" value={company?.twitterHandle || ''} onChange={(e) => setCompany({ ...company, twitterHandle: e.target.value })} placeholder="@company" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">LinkedIn URL</label>
            <input type="url" value={company?.linkedinUrl || ''} onChange={(e) => setCompany({ ...company, linkedinUrl: e.target.value })} className={inputCls} placeholder="https://linkedin.com/company/..." />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">Custom Domain</label>
        <input type="text" value={company?.customDomain || ''} onChange={(e) => setCompany({ ...company, customDomain: e.target.value })} placeholder="careers.yourcompany.com" className={inputCls} />
        <p className="text-xs text-stone-400 mt-1">CNAME this domain to our servers</p>
      </div>

      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
        <h4 className="font-semibold text-stone-800 mb-3">Social Sharing Buttons</h4>
        <div className="flex flex-wrap gap-4">
          {[
            { key: 'enableLinkedInShare', label: 'LinkedIn' },
            { key: 'enableTwitterShare', label: 'Twitter' },
            { key: 'enableFacebookShare', label: 'Facebook' },
            { key: 'enableEmailShare', label: 'Email' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={company?.[key] ?? true} onChange={(e) => setCompany({ ...company, [key]: e.target.checked })} className="w-4 h-4 text-brand-600 rounded" />
              <span className="text-sm text-stone-700 font-medium">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamTab({ company, setCompany }: { company: any; setCompany: any }) {
  const addTeamMember = () => {
    const newMember = {
      id: `temp-${Date.now()}`,
      name: '',
      role: '',
      photoUrl: '',
      bio: '',
    };
    setCompany({
      ...company,
      teamMembers: [...(company?.teamMembers || []), newMember],
    });
  };

  const updateTeamMember = (id: string, field: string, value: string) => {
    setCompany({
      ...company,
      teamMembers: company?.teamMembers?.map((m: any) =>
        m.id === id ? { ...m, [field]: value } : m
      ) || [],
    });
  };

  const removeTeamMember = (id: string) => {
    setCompany({
      ...company,
      teamMembers: company?.teamMembers?.filter((m: any) => m.id !== id) || [],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Team Members</h3>
          <p className="text-sm text-stone-500">Showcase your team on your career page</p>
        </div>
        <button
          onClick={addTeamMember}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all w-full sm:w-auto justify-center"
        >
          <Users className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {(!company?.teamMembers || company.teamMembers.length === 0) && (
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50">
          <Users className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No team members yet</p>
          <p className="text-sm text-stone-400 mt-1">Add your team to showcase on the career page</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {company?.teamMembers?.map((member: any, index: number) => (
          <div key={member.id} className="group relative p-5 bg-white rounded-2xl border border-stone-200 hover:border-brand-200 hover:shadow-md transition-all">
            <button
              onClick={() => removeTeamMember(member.id)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
              title="Remove"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-100 to-teal-100 rounded-xl overflow-hidden flex-shrink-0 border border-stone-100">
                {member.photoUrl ? (
                  <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-400">
                    <Users className="w-7 h-7" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateTeamMember(member.id, 'name', e.target.value)}
                    placeholder="Full Name"
                    className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all"
                  />
                  <input
                    type="text"
                    value={member.role}
                    onChange={(e) => updateTeamMember(member.id, 'role', e.target.value)}
                    placeholder="Job Title"
                    className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all"
                  />
                </div>
                <input
                  type="url"
                  value={member.photoUrl}
                  onChange={(e) => updateTeamMember(member.id, 'photoUrl', e.target.value)}
                  placeholder="Photo URL (https://...)"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all"
                />
                <textarea
                  value={member.bio}
                  onChange={(e) => updateTeamMember(member.id, 'bio', e.target.value)}
                  placeholder="Short bio about this team member..."
                  rows={2}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all resize-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BenefitsTab({ company, setCompany }: { company: any; setCompany: any }) {
  const iconOptions = [
    { value: 'heart', label: '❤️ Health' },
    { value: 'star', label: '⭐ Star' },
    { value: 'zap', label: '⚡ Energy' },
    { value: 'shield', label: '🛡️ Security' },
    { value: 'coffee', label: '☕ Perks' },
    { value: 'gift', label: '🎁 Bonus' },
    { value: 'home', label: '🏠 Remote' },
    { value: 'clock', label: '⏰ Flexibility' },
    { value: 'book', label: '📚 Learning' },
    { value: 'plane', label: '✈️ Travel' },
    { value: 'baby', label: '👶 Family' },
    { value: 'money', label: '💰 Finance' },
  ];

  const addBenefit = () => {
    const newBenefit = {
      id: `temp-${Date.now()}`,
      icon: 'heart',
      title: '',
      description: '',
    };
    setCompany({
      ...company,
      benefits: [...(company?.benefits || []), newBenefit],
    });
  };

  const updateBenefit = (id: string, field: string, value: string) => {
    setCompany({
      ...company,
      benefits: company?.benefits?.map((b: any) =>
        b.id === id ? { ...b, [field]: value } : b
      ) || [],
    });
  };

  const removeBenefit = (id: string) => {
    setCompany({
      ...company,
      benefits: company?.benefits?.filter((b: any) => b.id !== id) || [],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Company Benefits</h3>
          <p className="text-sm text-stone-500">Highlight perks that attract top talent</p>
        </div>
        <button
          onClick={addBenefit}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all w-full sm:w-auto justify-center"
        >
          <Gift className="w-4 h-4" />
          Add Benefit
        </button>
      </div>

      {(!company?.benefits || company.benefits.length === 0) && (
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50">
          <Gift className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No benefits added yet</p>
          <p className="text-sm text-stone-400 mt-1">Add benefits like health insurance, remote work, etc.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {company?.benefits?.map((benefit: any) => (
          <div key={benefit.id} className="group relative p-5 bg-white rounded-2xl border border-stone-200 hover:border-brand-200 hover:shadow-md transition-all">
            <button
              onClick={() => removeBenefit(benefit.id)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
              title="Remove"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <select
                  value={benefit.icon}
                  onChange={(e) => updateBenefit(benefit.id, 'icon', e.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all"
                >
                  {iconOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={benefit.title}
                  onChange={(e) => updateBenefit(benefit.id, 'title', e.target.value)}
                  placeholder="Benefit Title (e.g., Health Insurance)"
                  className="flex-1 px-3 py-2 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all"
                />
              </div>
              <textarea
                value={benefit.description}
                onChange={(e) => updateBenefit(benefit.id, 'description', e.target.value)}
                placeholder="Describe this benefit in detail..."
                rows={2}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all resize-none"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewTab({ company }: { company: any }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Live Preview</h3>
          <p className="text-sm text-stone-500">Preview how your career page will look</p>
        </div>
        <a
          href={`/careers/${company?.slug || ''}`}
          target="_blank"
          className="flex items-center gap-2 px-4 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-semibold hover:bg-stone-900 transition-colors w-full sm:w-auto justify-center"
        >
          <Eye className="w-4 h-4" />
          View Live Page
        </a>
      </div>

      <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-stone-800 text-white px-4 py-3 text-sm flex items-center gap-2">
          <div className="flex gap-1.5 mr-3">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <Globe className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-stone-300">careers.yoursite.com/{company?.slug || 'your-company'}</span>
        </div>
        <div
          className="aspect-video bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center relative"
          style={company?.heroBackground ? { backgroundImage: `url(${company.heroBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          {company?.heroBackground && <div className="absolute inset-0 bg-black/40" />}
          <div className="text-center relative z-10 px-6">
            {company?.logoUrl && (
              <img src={company.logoUrl} alt="Logo" className="h-12 mx-auto mb-4 object-contain" />
            )}
            <div className={`text-2xl sm:text-3xl font-bold mb-2 ${company?.heroBackground ? 'text-white' : 'text-stone-900'}`}>
              {company?.heroTitle || 'Join Our Team'}
            </div>
            <p className={`text-sm sm:text-base ${company?.heroBackground ? 'text-white/80' : 'text-stone-500'}`}>
              {company?.heroSubtitle || 'Your hero subtitle here'}
            </p>
          </div>
        </div>
      </div>

      {/* Team preview */}
      {company?.teamMembers?.length > 0 && company?.showTeamPhotos && (
        <div className="p-5 rounded-xl bg-stone-50 border border-stone-200">
          <h4 className="font-semibold text-stone-800 mb-3">Team Preview ({company.teamMembers.length} members)</h4>
          <div className="flex flex-wrap gap-3">
            {company.teamMembers.slice(0, 6).map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-stone-100">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center overflow-hidden">
                  {m.photoUrl ? <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-brand-500" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-800">{m.name || 'Unnamed'}</p>
                  <p className="text-xs text-stone-400">{m.role || 'No role'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benefits preview */}
      {company?.benefits?.length > 0 && company?.showBenefits && (
        <div className="p-5 rounded-xl bg-stone-50 border border-stone-200">
          <h4 className="font-semibold text-stone-800 mb-3">Benefits Preview ({company.benefits.length} items)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {company.benefits.slice(0, 6).map((b: any) => (
              <div key={b.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-stone-100">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-stone-700">{b.title || 'Unnamed benefit'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`rounded-xl p-4 border ${company?.isPublished ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className={`flex items-center gap-2 ${company?.isPublished ? 'text-emerald-800' : 'text-amber-800'}`}>
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Publishing Status</span>
        </div>
        <p className={`text-sm mt-1 ${company?.isPublished ? 'text-emerald-600' : 'text-amber-600'}`}>
          {company?.isPublished
            ? 'Your career page is live and visible to candidates'
            : 'Your career page is in draft mode. Save changes to publish it.'}
        </p>
      </div>
    </div>
  );
}
