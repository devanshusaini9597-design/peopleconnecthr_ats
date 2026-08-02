import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Globe, MapPin, Calendar,
  Settings, Users, Briefcase, Plus, X, Upload, Save,
  Trash2, Mail, UserPlus, GripVertical, Link as LinkIcon, Loader2, ExternalLink,
  Shield, Eye, UserCog
} from 'lucide-react';
import API_URL from '../config';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import { useToast } from './Toast';
import CareerPageBuilderSection from './CareerPageBuilderSection';
import {
  TIMEZONE_OPTIONS,
  COUNTRY_CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  detectBrowserTimezone,
  countryForCurrency,
  currencyForCountry,
} from '../data/locales';

const INVITE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Full org access', icon: Shield },
  { value: 'recruiter', label: 'Recruiter', description: 'Hiring workflows', icon: Briefcase },
  { value: 'interviewer', label: 'Interviewer', description: 'Interview schedule', icon: UserCog },
  { value: 'readonly', label: 'Read Only', description: 'View-only access', icon: Eye },
];

const BrandToggle = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer shrink-0">
    <input
      type="checkbox"
      className="sr-only peer"
      checked={checked}
      onChange={onChange}
    />
    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
  </label>
);

const TABS = [
  { id: 'general', icon: Settings, label: 'General' },
  { id: 'pipeline', icon: GripVertical, label: 'Pipeline' },
  { id: 'team', icon: Users, label: 'Team' },
  { id: 'careers', icon: Briefcase, label: 'Careers' },
];

const ROLE_BADGE = {
  admin: 'badge-danger',
  recruiter: 'badge-warning',
  interviewer: 'badge-info',
  readonly: 'badge-neutral',
  owner: 'badge-brand',
};

const dateFormatSelectOptions = DATE_FORMAT_OPTIONS.map((d) => ({ ...d, icon: Calendar }));

function buildTimezoneOptions(extraTz) {
  const base = TIMEZONE_OPTIONS.map((t) => ({ ...t, icon: Globe }));
  if (extraTz && !base.some((t) => t.value === extraTz)) {
    base.unshift({
      value: extraTz,
      label: extraTz,
      description: 'Detected on this device',
      icon: Globe,
    });
  }
  return base;
}

export default function OrganizationSettingsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const logoInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoDragging, setLogoDragging] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const detectedTz = detectBrowserTimezone();
  const [org, setOrg] = useState({
    name: '',
    domain: '',
    logo: '',
    timezone: detectedTz,
    currency: 'USD',
    country: countryForCurrency('USD') || 'US',
    dateFormat: 'MM/DD/YYYY',
    atsSettings: {
      pipelineStages: ['Sourced', 'Applied', 'Phone Screen', 'Interview', 'Offer', 'Hired'],
      defaultSources: ['LinkedIn', 'Indeed', 'Company Website', 'Referral'],
      careersPageEnabled: false,
      careersPageTitle: 'Join Our Team',
      careersPageDescription: '',
      candidatePortalEnabled: false
    }
  });

  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('recruiter');

  useEffect(() => {
    const onCollapse = (e) => setSidebarCollapsed(!!e.detail);
    window.addEventListener('sidebarCollapsed', onCollapse);
    return () => window.removeEventListener('sidebarCollapsed', onCollapse);
  }, []);

  useEffect(() => {
    fetchOrgData();
    if (activeTab === 'team') {
      fetchMembers();
    }
  }, [activeTab]);

  const normalizeOrgPayload = (raw) => {
    const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
    const settings = payload?.settings || {};
    const ats = payload?.atsSettings || {};
    const currency = settings.currency || payload?.currency || 'USD';
    const timezone = settings.timezone || payload?.timezone || detectBrowserTimezone();
    return {
      name: payload?.name || '',
      domain: payload?.domain || '',
      logo: payload?.logo || '',
      timezone,
      currency,
      country: countryForCurrency(currency) || 'US',
      dateFormat: settings.dateFormat || payload?.dateFormat || 'MM/DD/YYYY',
      atsSettings: {
        pipelineStages: ats.pipelineStages || ['Sourced', 'Applied', 'Phone Screen', 'Interview', 'Offer', 'Hired'],
        defaultSources: ats.defaultSources || ['LinkedIn', 'Indeed', 'Company Website', 'Referral'],
        careersPageEnabled: ats.careersPageEnabled ?? ats.enableCareersPage ?? false,
        careersPageTitle: ats.careersPageTitle || 'Join Our Team',
        careersPageDescription: ats.careersPageDescription || '',
        candidatePortalEnabled: ats.candidatePortalEnabled ?? ats.enableCandidatePortal ?? false,
        brandColor: ats.brandColor,
        whiteLabel: ats.whiteLabel,
        careersCustomDomain: ats.careersCustomDomain,
        portalLocalization: ats.portalLocalization || { enabled: false, defaultLocale: 'en', supportedLocales: ['en'] },
      },
    };
  };

  const fetchOrgData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/organization`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrg(normalizeOrgPayload(data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/organization/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.data || []);
        setMembers(list);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const processLogoFile = (file) => {
    if (!file) return;
    const okType = /image\/(svg\+xml|png|jpe?g|gif|webp)/i.test(file.type)
      || /\.(svg|png|jpe?g|gif|webp)$/i.test(file.name);
    if (!okType) {
      toast.error('Use SVG, PNG, JPG, GIF, or WebP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setOrg((prev) => ({ ...prev, logo: String(reader.result || '') }));
      toast.success('Logo ready — click Save Changes to apply');
    };
    reader.onerror = () => toast.error('Failed to read logo file');
    reader.readAsDataURL(file);
  };

  const handleLogoDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLogoDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processLogoFile(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const body = {
        name: org.name,
        domain: org.domain,
        logo: org.logo || '',
        settings: {
          timezone: org.timezone,
          currency: org.currency,
          dateFormat: org.dateFormat,
        },
        atsSettings: {
          pipelineStages: org.atsSettings.pipelineStages,
          defaultSources: org.atsSettings.defaultSources,
          enableCareersPage: !!org.atsSettings.careersPageEnabled,
          careersPageEnabled: !!org.atsSettings.careersPageEnabled,
          careersPageTitle: org.atsSettings.careersPageTitle,
          careersPageDescription: org.atsSettings.careersPageDescription,
          enableCandidatePortal: !!org.atsSettings.candidatePortalEnabled,
          candidatePortalEnabled: !!org.atsSettings.candidatePortalEnabled,
          brandColor: org.atsSettings.brandColor,
          whiteLabel: org.atsSettings.whiteLabel,
          careersCustomDomain: org.atsSettings.careersCustomDomain,
          portalLocalization: org.atsSettings.portalLocalization,
        },
      };
      const res = await fetch(`${API_URL}/api/organization`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to save settings');
      try {
        const existing = JSON.parse(localStorage.getItem('orgData') || '{}');
        localStorage.setItem('orgData', JSON.stringify({
          ...existing,
          name: org.name || existing.name,
          logo: org.logo || existing.logo || null,
        }));
        window.dispatchEvent(new Event('orgDataUpdated'));
      } catch { /* ignore */ }
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/onboarding/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      if (!res.ok) throw new Error('Failed to send invite');
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const applyDetectedTimezone = () => {
    const tz = detectBrowserTimezone();
    setOrg((prev) => ({ ...prev, timezone: tz }));
    toast.success(`Timezone set to ${tz}`);
  };

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter pb-24">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-56 skeleton-ats rounded-lg" />
            <div className="h-4 w-80 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="card-ats-bordered overflow-hidden mt-2">
          <div className="flex gap-2 p-3 border-b border-stone-100 bg-stone-50/80">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-24 skeleton-ats rounded-xl" />
            ))}
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="h-3 w-24 skeleton-ats rounded" />
                <div className="h-11 w-full skeleton-ats rounded-xl" />
                <div className="h-3 w-24 skeleton-ats rounded" />
                <div className="h-11 w-full skeleton-ats rounded-xl" />
              </div>
              <div className="h-40 skeleton-ats rounded-2xl" />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-20 skeleton-ats rounded" />
                  <div className="h-11 w-full skeleton-ats rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page-shell-ats animate-page-enter ${activeTab !== 'team' ? 'pb-32 sm:pb-28' : 'pb-10'}`}>
      <PageHeader
        icon={Building2}
        title="Organization Settings"
        subtitle="Company preferences, hiring pipeline, team access, and careers page."
        gradientTitle
      />

      <div className="card-ats-bordered overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

        {/* Tab strip — segmented Jobs-style control */}
        <div className="p-3 sm:p-4 border-b border-stone-100 bg-stone-50/80 mt-1">
          <div className="flex gap-1 p-1 bg-stone-100/90 rounded-2xl overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-1 sm:flex-none justify-center ${
                    active
                      ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80'
                      : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : ''}`} />
                  {tab.label}
                  {active && <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-brand-500" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-6 md:p-8">
          {activeTab === 'general' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h3 className="section-title-ats">
                  <Building2 className="w-4 h-4 text-brand-600" />
                  Company identity
                </h3>
                <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="label-ats">Company Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                        <input
                          type="text"
                          value={org.name}
                          onChange={e => setOrg({ ...org, name: e.target.value })}
                          className="input-ats !pl-10"
                          placeholder="Acme Corp"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-ats">Company Domain</label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                        <input
                          type="text"
                          value={org.domain}
                          onChange={e => setOrg({ ...org, domain: e.target.value })}
                          className="input-ats !pl-10"
                          placeholder="acme.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="label-ats">Company Logo</label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/svg+xml,image/png,image/jpeg,image/gif,image/webp,.svg,.png,.jpg,.jpeg,.gif,.webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processLogoFile(file);
                        e.target.value = '';
                      }}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => logoInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          logoInputRef.current?.click();
                        }
                      }}
                      onDragEnter={(e) => { e.preventDefault(); setLogoDragging(true); }}
                      onDragOver={(e) => { e.preventDefault(); setLogoDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setLogoDragging(false); }}
                      onDrop={handleLogoDrop}
                      className={`dropzone-ats flex flex-col items-center justify-center text-center p-6 cursor-pointer group min-h-[168px] ${
                        logoDragging ? 'border-brand-500 bg-brand-50/60' : ''
                      }`}
                    >
                      {org.logo ? (
                        <div className="flex flex-col items-center gap-3 w-full">
                          <img
                            src={org.logo}
                            alt="Company logo"
                            className="max-h-20 max-w-full object-contain rounded-xl border border-stone-200 bg-white p-2 shadow-sm"
                          />
                          <p className="text-sm font-semibold text-stone-700">Click or drop to replace</p>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrg((prev) => ({ ...prev, logo: '' }));
                            }}
                          >
                            Remove logo
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-brand-100">
                            <Upload className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-semibold text-stone-700">Click to upload or drag & drop</p>
                          <p className="text-xs text-stone-500 mt-1">SVG, PNG, JPG or GIF (max. 2MB)</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="section-title-ats">
                  <Globe className="w-4 h-4 text-brand-600" />
                  Locale & formats
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="label-ats !mb-0">Timezone</label>
                      <button
                        type="button"
                        onClick={applyDetectedTimezone}
                        className="text-[11px] font-bold text-brand-600 hover:text-brand-700 whitespace-nowrap"
                      >
                        Use my timezone
                      </button>
                    </div>
                    <PremiumSelect
                      value={org.timezone}
                      onChange={(v) => setOrg({ ...org, timezone: v || detectBrowserTimezone() })}
                      options={buildTimezoneOptions(detectedTz)}
                      placeholder="Select timezone"
                      icon={MapPin}
                      searchable
                      searchPlaceholder="Search timezones…"
                    />
                    <p className="text-[11px] text-stone-400 mt-1.5 font-medium truncate">
                      Detected: {detectedTz}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <label className="label-ats">Country / Currency</label>
                    <PremiumSelect
                      value={org.country}
                      onChange={(countryCode) => {
                        const code = countryCode || 'US';
                        setOrg({
                          ...org,
                          country: code,
                          currency: currencyForCountry(code),
                        });
                      }}
                      options={COUNTRY_CURRENCY_OPTIONS}
                      placeholder="Select country"
                      searchable
                      searchPlaceholder="Search countries…"
                    />
                    <p className="text-[11px] text-stone-400 mt-1.5 font-medium">
                      Currency: <span className="text-stone-600 font-semibold">{org.currency}</span>
                    </p>
                  </div>
                  <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                    <label className="label-ats">Date Format</label>
                    <PremiumSelect
                      value={org.dateFormat}
                      onChange={(v) => setOrg({ ...org, dateFormat: v || 'MM/DD/YYYY' })}
                      options={dateFormatSelectOptions}
                      placeholder="Select format"
                      icon={Calendar}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h3 className="section-title-ats">
                  <GripVertical className="w-4 h-4 text-brand-600" />
                  Pipeline stages
                </h3>
                <p className="text-sm text-stone-500 -mt-2 mb-4">Define the stages candidates move through in your hiring process.</p>

                <div className="bg-stone-50/80 rounded-2xl p-3 space-y-2 border border-stone-100 max-w-2xl">
                  {org.atsSettings.pipelineStages.map((stage, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-white p-3 rounded-xl border border-stone-200/80 shadow-sm group hover:border-brand-200 hover:shadow-md hover:bg-brand-50/30 transition-all duration-200 relative overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-400 to-teal-600 opacity-70" />
                      <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 border border-brand-100">
                        {i + 1}
                      </span>
                      <GripVertical className="w-4 h-4 text-stone-400 cursor-grab group-hover:text-brand-500 transition-colors flex-shrink-0" />
                      <span className="flex-1 text-sm font-semibold text-stone-800">{stage}</span>
                      <button
                        type="button"
                        className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        aria-label={`Remove ${stage}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 mt-1">
                    <input
                      type="text"
                      placeholder="New stage name…"
                      className="flex-1 input-ats bg-white"
                    />
                    <button type="button" className="btn-primary whitespace-nowrap">
                      <Plus className="w-4 h-4" /> Add stage
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="section-title-ats">
                  <Briefcase className="w-4 h-4 text-brand-600" />
                  Default sources
                </h3>
                <p className="text-sm text-stone-500 -mt-2 mb-4">Common sources where your candidates come from.</p>
                <div className="flex flex-wrap gap-2 max-w-2xl">
                  {org.atsSettings.defaultSources.map((source, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 text-sm font-semibold rounded-xl border border-brand-100 hover:bg-brand-100/80 transition-colors"
                    >
                      {source}
                      <button type="button" className="hover:text-brand-900 focus:outline-none p-0.5 rounded" aria-label={`Remove ${source}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-stone-300 text-stone-600 text-sm font-semibold rounded-xl hover:bg-stone-50 hover:border-brand-300 hover:text-brand-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Source
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 tracking-tight">Team access</h3>
                  <p className="text-sm text-stone-500 mt-0.5">Invite colleagues or manage members in the directory.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/team')}
                  className="btn-secondary whitespace-nowrap"
                >
                  <Users className="w-4 h-4" />
                  Open Team Directory
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>

              <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/90 via-white to-teal-50/40 p-5 sm:p-6 overflow-hidden relative">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <h3 className="text-sm font-bold text-brand-900 mb-4 flex items-center gap-2 mt-1">
                  <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-500/25">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  Invite new member
                </h3>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1 min-w-0">
                    <label className="label-ats">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="input-ats !pl-10 bg-white"
                      />
                    </div>
                  </div>
                  <div className="sm:w-52 flex-shrink-0">
                    <label className="label-ats">Role</label>
                    <PremiumSelect
                      value={inviteRole}
                      onChange={(v) => setInviteRole(v || 'recruiter')}
                      options={INVITE_ROLE_OPTIONS}
                      placeholder="Select role"
                      icon={Shield}
                      compact
                    />
                  </div>
                  <button type="submit" className="btn-primary whitespace-nowrap w-full sm:w-auto">
                    <UserPlus className="w-4 h-4" />
                    Send Invite
                  </button>
                </form>
              </div>

              <div>
                <h3 className="section-title-ats">
                  <Users className="w-4 h-4 text-brand-600" />
                  Team members
                  {members.length > 0 && (
                    <span className="ml-auto text-xs font-bold text-stone-400 normal-case tracking-normal">
                      {members.length} total
                    </span>
                  )}
                </h3>
                {members.length > 0 ? (
                  <div className="table-shell-ats">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-stone-50/90 border-b border-stone-100 text-stone-500 font-semibold text-xs uppercase tracking-wide">
                          <tr>
                            <th className="px-4 sm:px-5 py-3.5">Member</th>
                            <th className="px-4 sm:px-5 py-3.5">Role</th>
                            <th className="px-4 sm:px-5 py-3.5">Status</th>
                            <th className="px-4 sm:px-5 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {members.map((m) => (
                            <tr key={m._id} className="hover:bg-brand-50/30 transition-colors group">
                              <td className="px-4 sm:px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-white flex-shrink-0">
                                    {(m.name ? m.name.charAt(0) : m.email.charAt(0)).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-stone-900 truncate">{m.name || 'Pending User'}</div>
                                    <div className="text-stone-500 text-xs truncate">{m.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5">
                                <span className={`${ROLE_BADGE[m.role] || 'badge-neutral'} capitalize`}>
                                  {m.role}
                                </span>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5">
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 text-right">
                                <button
                                  type="button"
                                  className="p-2 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  aria-label="Remove member"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="card-ats-bordered">
                    <EmptyState
                      icon={Users}
                      tone="emerald"
                      message="No team members yet"
                      subMessage="Invite colleagues above, or open the Team Directory to manage your org."
                      action={
                        <button
                          type="button"
                          onClick={() => navigate('/team')}
                          className="btn-secondary"
                        >
                          <Users className="w-4 h-4" />
                          Open Team Directory
                        </button>
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'careers' && (
            <div className="space-y-6 animate-fade-in">
              <div className="card-ats-bordered relative overflow-hidden p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-teal-50/50">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2.5 tracking-tight">
                    Public Careers Page
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        org.atsSettings.careersPageEnabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-stone-100 text-stone-500 border-stone-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${org.atsSettings.careersPageEnabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                      {org.atsSettings.careersPageEnabled ? 'Live' : 'Off'}
                    </span>
                  </h3>
                  <p className="text-sm text-stone-600 mt-1.5 max-w-xl leading-relaxed">
                    Host a branded job board to attract talent directly from your website.
                  </p>
                </div>
                <BrandToggle
                  checked={org.atsSettings.careersPageEnabled}
                  onChange={e => setOrg({ ...org, atsSettings: { ...org.atsSettings, careersPageEnabled: e.target.checked } })}
                />
              </div>

              <div className={`space-y-5 transition-opacity duration-300 ${!org.atsSettings.careersPageEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                  <label className="label-ats">Page Title</label>
                  <input
                    type="text"
                    value={org.atsSettings.careersPageTitle}
                    onChange={e => setOrg({ ...org, atsSettings: { ...org.atsSettings, careersPageTitle: e.target.value } })}
                    className="input-ats"
                  />
                </div>
                <div>
                  <label className="label-ats">Welcome Message / Description</label>
                  <textarea
                    rows="4"
                    value={org.atsSettings.careersPageDescription}
                    onChange={e => setOrg({ ...org, atsSettings: { ...org.atsSettings, careersPageDescription: e.target.value } })}
                    className="textarea-ats"
                    placeholder="Tell candidates why they should join your team..."
                  />
                </div>

                <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                      <LinkIcon className="w-5 h-5 text-brand-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-900">Your public URL</div>
                      <div className="text-xs text-brand-600 font-medium truncate hover:underline cursor-pointer">
                        https://skillnix.com/careers/{org.domain || 'your-company'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <CareerPageBuilderSection />

              <div className="flex items-center justify-between p-5 rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)] gap-4">
                <div className="min-w-0 pr-2">
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">Candidate Portal</h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Let candidates track application status and update their profile in a branded portal.
                  </p>
                </div>
                <BrandToggle
                  checked={org.atsSettings.candidatePortalEnabled}
                  onChange={e => setOrg({ ...org, atsSettings: { ...org.atsSettings, candidatePortalEnabled: e.target.checked } })}
                />
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)] gap-4">
                <div className="min-w-0 pr-2">
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">Portal localization</h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Enable multi-locale candidate portal forms (en, es, fr, de, hi). Requires portal.localization.
                  </p>
                </div>
                <BrandToggle
                  checked={!!org.atsSettings.portalLocalization?.enabled}
                  onChange={e => setOrg({
                    ...org,
                    atsSettings: {
                      ...org.atsSettings,
                      portalLocalization: {
                        ...(org.atsSettings.portalLocalization || {}),
                        enabled: e.target.checked,
                        defaultLocale: org.atsSettings.portalLocalization?.defaultLocale || 'en',
                        supportedLocales: org.atsSettings.portalLocalization?.supportedLocales || ['en', 'es', 'fr', 'de', 'hi']
                      }
                    }
                  })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {activeTab !== 'team' && (
        <div
          className={`fixed bottom-0 right-0 z-40 left-0 ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-[280px]'}`}
        >
          <div className="border-t border-stone-200/80 bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.08)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] sm:text-xs text-stone-400 font-medium text-center sm:text-left order-2 sm:order-1 leading-snug px-1">
                  Changes apply org-wide.
                </p>
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center order-1 sm:order-2">
                  <button
                    type="button"
                    onClick={fetchOrgData}
                    disabled={saving}
                    className="btn-secondary !px-3 !py-2.5 !text-sm min-w-0 w-full sm:w-auto"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary !px-3 !py-2.5 !text-sm min-w-0 w-full sm:w-auto"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> <span className="truncate">Saving…</span></>
                    ) : (
                      <><Save className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Save Changes</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
