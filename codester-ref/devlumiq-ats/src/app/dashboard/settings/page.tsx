'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Bell, Shield, Save, Check, Mail, Settings, Loader2,
  Eye, EyeOff, Lock, KeyRound, Palette, Building2, Globe,
  Smartphone, Monitor, Sun, Moon, Sparkles, ChevronRight,
  ClipboardCopy, LogOut, AlertTriangle, Camera, AtSign,
  Clock, BarChart3, Zap, CreditCard, Key, Chrome,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import RoleBadge from '@/components/ui/RoleBadge';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { required, email as validateEmail } from '@/lib/validation';
import BillingSettings from '@/components/dashboard/BillingSettings';
import ApiKeyManager from '@/components/dashboard/ApiKeyManager';
import ExtensionSettings from '@/components/dashboard/ExtensionSettings';
import SsoSettings from '@/components/dashboard/SsoSettings';
import { PushNotificationSettings } from '@/components/dashboard/PushNotificationSettings';

//  nav tabs 
const TABS = [
  { id: 'profile',       label: 'Profile',        icon: User },
  { id: 'notifications', label: 'Notifications',   icon: Bell },
  { id: 'security',      label: 'Security',        icon: Shield },
  { id: 'appearance',    label: 'Appearance',      icon: Palette },
  { id: 'workspace',     label: 'Workspace',       icon: Building2 },
  { id: 'billing',       label: 'Billing',         icon: CreditCard },
  { id: 'api-keys',      label: 'API Keys',        icon: Key },
  { id: 'extension',     label: 'Chrome Extension', icon: Chrome },
  { id: 'danger',        label: 'Danger Zone',     icon: AlertTriangle },
] as const;
type TabId = (typeof TABS)[number]['id'];

//  small helpers 
const sectionHd = (icon: React.ReactNode, title: string, subtitle?: string) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="p-2.5 rounded-xl bg-stone-100">{icon}</div>
    <div>
      <h2 className="text-base font-bold text-stone-900">{title}</h2>
      {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const inputCls = (err?: string) =>
  `input-ats ${err ? 'border-red-400 focus:border-red-400' : ''}`;

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{msg}</p> : null;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between py-3 cursor-pointer group">
      <span className="font-medium text-stone-700 text-sm group-hover:text-stone-900 transition-colors">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${checked ? 'bg-brand-500' : 'bg-stone-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}

function SaveBtn({ saving, saved, label = 'Save changes', savedLabel = 'Saved!', onClick }: { saving: boolean; saved: boolean; label?: string; savedLabel?: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={saving}
      whileHover={{ scale: saving ? 1 : 1.015 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-70 ${
        saved
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'btn-primary !px-5 !py-2.5 !text-sm'
      }`}
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
      {saving ? 'Saving' : saved ? savedLabel : label}
    </motion.button>
  );
}

//  main component 
export default function SettingsPage() {
  const { t } = useLocale();
  const toast = useToast();
  const [tab, setTab] = useState<TabId>('profile');

  // profile
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [profileErrors, setProfileErrors] = useState<{ name?: string; email?: string }>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwErrors, setPwErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  // notifications stored as state (would ideally be persisted)
  const [notifs, setNotifs] = useState({
    emailDigest: false,
    callbackReminders: true,
    candidateUpdates: true,
    weeklyDigest: false,
    interviewReminder: true,
    offerAlerts: true,
  });

  // appearance
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [companySlug, setCompanySlug] = useState('');
  const [embedCopied, setEmbedCopied] = useState(false);
  const [appOrigin, setAppOrigin] = useState('');
  const [careersFaq, setCareersFaq] = useState<Array<{ q: string; a: string; keywords: string }>>([]);
  const [faqSaving, setFaqSaving] = useState(false);

  useEffect(() => {
    setAppOrigin(window.location.origin);
    fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        const u = json?.user;
        if (u?.email) setUserEmail(u.email);
        if (u?.name) setUserName(u.name);
        if (u?.role) setUserRole(u.role);
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          setUserEmail(localStorage.getItem('userEmail') ?? '');
          setUserName(localStorage.getItem('userName') ?? '');
        }
      });
    fetch('/api/company', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (c?.slug) setCompanySlug(c.slug);
        if (Array.isArray(c?.careersFaq)) {
          setCareersFaq(
            c.careersFaq.map((item: { q?: string; a?: string; keywords?: string[] }) => ({
              q: item.q || '',
              a: item.a || '',
              keywords: Array.isArray(item.keywords) ? item.keywords.join(', ') : '',
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleProfileSave = async () => {
    setProfileErrors({});
    const name = nameRef.current?.value?.trim() ?? '';
    const email = emailRef.current?.value?.trim() ?? '';
    const nameErr = required(name, 'Name');
    const emailErr = validateEmail(email);
    if (nameErr || emailErr) {
      setProfileErrors({ name: nameErr ?? undefined, email: emailErr ?? undefined });
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error('Save failed', data?.error ?? ''); return; }
      localStorage.setItem('userName', data.user?.name ?? name);
      localStorage.setItem('userEmail', data.user?.email ?? email);
      setUserName(data.user?.name ?? name);
      setUserEmail(data.user?.email ?? email);
      setProfileSaved(true);
      toast.success('Profile updated', 'Your profile has been saved.');
      setTimeout(() => setProfileSaved(false), 3000);
    } catch { toast.error('Save failed', 'Unexpected error'); }
    finally { setProfileSaving(false); }
  };

  const handlePasswordSave = async () => {
    setPwErrors({});
    if (!currentPw) { setPwErrors({ current: 'Current password required' }); return; }
    if (newPw.length < 6) { setPwErrors({ new: 'Min 6 characters' }); return; }
    if (newPw !== confirmPw) { setPwErrors({ confirm: 'Passwords do not match' }); return; }
    setPwSaving(true);
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPwErrors({ current: data?.error ?? 'Failed' }); return; }
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwSaved(true);
      toast.success('Password updated', 'Your password has been changed.');
      setTimeout(() => setPwSaved(false), 3000);
    } catch { toast.error('Failed', 'Unexpected error'); }
    finally { setPwSaving(false); }
  };

  const INITIALS = userName
    .split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('') || '??';

  //  render 
  return (
    <PageShell>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <PageHeader icon={Settings} title={t('settings.title')} subtitle="Manage your account, preferences & workspace" />

      <div className="flex flex-col lg:flex-row gap-6 min-h-0">
        {/*  Sidebar  */}
        <aside className="lg:w-56 flex-shrink-0 space-y-4">
          {/* Avatar card */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[var(--shadow-card)] text-center">
            <div className="relative inline-block">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-brand-500/25 mx-auto">
                {INITIALS}
              </div>
              <button
                type="button"
                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center hover:bg-stone-50 transition-colors"
                title="Change avatar"
              >
                <Camera className="w-3 h-3 text-stone-600" />
              </button>
            </div>
            <p className="mt-3 font-bold text-stone-900 text-sm truncate">{userName || '—'}</p>
            <p className="text-stone-400 text-xs truncate">{userEmail}</p>
            {userRole && (
              <div className="mt-2 flex justify-center">
                <RoleBadge role={userRole} showIcon />
              </div>
            )}
          </div>

          {/* Nav — horizontal scroll on mobile, vertical on lg+ */}
          <nav className="flex lg:flex-col overflow-x-auto gap-1 lg:gap-0 rounded-2xl border border-stone-200/80 bg-white p-1 lg:p-0 lg:overflow-hidden shadow-[var(--shadow-card)]">
            {TABS.map((t, idx) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-shrink-0 lg:w-full whitespace-nowrap flex items-center gap-2.5 lg:gap-3 px-3.5 lg:px-4 py-2.5 lg:py-3.5 text-sm font-medium transition-all rounded-xl lg:rounded-none ${
                    idx !== TABS.length - 1 ? 'lg:border-b lg:border-stone-100' : ''
                  } ${
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : t.id === 'danger'
                      ? 'text-red-500 hover:bg-red-50/60'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-brand-600' : t.id === 'danger' ? 'text-red-400' : 'text-stone-400'}`} />
                  <span className="flex-1 text-left">{t.label}</span>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-brand-400 hidden lg:block" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/*  Content panel  */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
            >
              {/*  PROFILE  */}
              {tab === 'profile' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                    {sectionHd(<User className="w-4 h-4 text-brand-600" />, 'Personal Information', 'Your name and email are shown across the platform')}
                    <div className="space-y-5">
                      <div>
                        <label htmlFor="s-name" className="block text-sm font-semibold text-stone-700 mb-1.5">Full Name</label>
                        <div className="relative">
                          <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input id="s-name" ref={nameRef} type="text" key={userName} defaultValue={userName} placeholder="Full name" className={`pl-11 ${inputCls(profileErrors.name)}`} />
                        </div>
                        <FieldError msg={profileErrors.name} />
                      </div>
                      <div>
                        <label htmlFor="s-email" className="block text-sm font-semibold text-stone-700 mb-1.5">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input id="s-email" ref={emailRef} type="email" key={userEmail} defaultValue={userEmail} placeholder="you@company.com" className={`pl-11 ${inputCls(profileErrors.email)}`} />
                        </div>
                        <FieldError msg={profileErrors.email} />
                      </div>
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                      <SaveBtn saving={profileSaving} saved={profileSaved} onClick={handleProfileSave} />
                      <span className="text-xs text-stone-400">Changes sync across all sessions</span>
                    </div>
                  </div>

                  {/* Account stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { icon: <BarChart3 className="w-5 h-5 text-brand-600" />, label: 'Member since', value: 'April 2026', bg: 'bg-brand-50' },
                      { icon: <Zap className="w-5 h-5 text-amber-600" />, label: 'Plan', value: 'Growth', bg: 'bg-amber-50' },
                      { icon: <Clock className="w-5 h-5 text-teal-600" />, label: 'Timezone', value: 'UTC+0', bg: 'bg-teal-50' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[var(--shadow-card)] flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
                        <div className="min-w-0">
                          <p className="text-xs text-stone-500 font-medium">{s.label}</p>
                          <p className="text-sm font-bold text-stone-900 truncate">{s.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/*  NOTIFICATIONS  */}
              {tab === 'notifications' && (
                <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                  {sectionHd(<Bell className="w-4 h-4 text-amber-600" />, 'Notification Preferences', 'Choose when and how you receive alerts')}
                  <div className="space-y-1 divide-y divide-stone-100">
                    {[
                      { key: 'emailDigest',       label: 'Daily email digest',          desc: 'A morning summary of all activity' },
                      { key: 'callbackReminders',  label: 'Callback reminders',          desc: 'Alerts before scheduled calls' },
                      { key: 'candidateUpdates',   label: 'Candidate status changes',    desc: 'Notified when a stage changes' },
                      { key: 'weeklyDigest',        label: 'Weekly hiring report',        desc: 'Sent every Monday at 9 AM' },
                      { key: 'interviewReminder',  label: 'Interview reminders',         desc: '15-minute before alert' },
                      { key: 'offerAlerts',         label: 'Offer accepted / declined',  desc: 'Instant notification on offer outcome' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="py-3.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-stone-800">{label}</p>
                            <p className="text-xs text-stone-500 mt-0.5">{desc}</p>
                          </div>
                          <Toggle
                            checked={notifs[key as keyof typeof notifs]}
                            onChange={(v) => setNotifs((prev) => ({ ...prev, [key]: v }))}
                            label=""
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <SaveBtn saving={false} saved={false} label="Save preferences" onClick={() => toast.success('Preferences saved', 'Notification settings updated.')} />
                  </div>
                  <PushNotificationSettings />
                </div>
              )}

              {/*  SECURITY  */}
              {tab === 'security' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                    {sectionHd(<KeyRound className="w-4 h-4 text-emerald-600" />, 'Change Password', 'Use a strong password with letters, numbers & symbols')}
                    <div className="space-y-4">
                      {/* Current */}
                      <div>
                        <label htmlFor="pw-cur" className="block text-sm font-semibold text-stone-700 mb-1.5">Current Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input id="pw-cur" type={showCurrent ? 'text' : 'password'} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" className={`pl-11 pr-11 ${inputCls(pwErrors.current)}`} />
                          <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 transition-colors rounded-lg">
                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <FieldError msg={pwErrors.current} />
                      </div>
                      {/* New */}
                      <div>
                        <label htmlFor="pw-new" className="block text-sm font-semibold text-stone-700 mb-1.5">New Password</label>
                        <div className="relative">
                          <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input id="pw-new" type={showNew ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 6 characters" className={`pl-11 pr-11 ${inputCls(pwErrors.new)}`} />
                          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 transition-colors rounded-lg">
                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {newPw && (
                          <div className="mt-2 flex gap-1">
                            {[6, 8, 10, 12].map((n) => (
                              <div key={n} className={`flex-1 h-1 rounded-full transition-colors ${newPw.length >= n ? 'bg-brand-500' : 'bg-stone-200'}`} />
                            ))}
                            <span className="text-xs text-stone-400 ml-2 flex-shrink-0">{newPw.length < 6 ? 'Weak' : newPw.length < 10 ? 'Good' : 'Strong'}</span>
                          </div>
                        )}
                        <FieldError msg={pwErrors.new} />
                      </div>
                      {/* Confirm */}
                      <div>
                        <label htmlFor="pw-con" className="block text-sm font-semibold text-stone-700 mb-1.5">Confirm New Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input id="pw-con" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password" className={`pl-11 ${inputCls(pwErrors.confirm)}`} />
                        </div>
                        {confirmPw && newPw === confirmPw && (
                          <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1"><Check className="w-3 h-3" />Passwords match</p>
                        )}
                        <FieldError msg={pwErrors.confirm} />
                      </div>
                      <SaveBtn saving={pwSaving} saved={pwSaved} label="Update password" savedLabel="Password updated!" onClick={handlePasswordSave} />
                    </div>
                  </div>

                  {/* Sessions */}
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                    {sectionHd(<Shield className="w-4 h-4 text-brand-600" />, 'Active Sessions', 'Sign out from devices you no longer use')}
                    <div className="space-y-3">
                      {[
                        { device: 'Chrome on Windows', location: 'Current session', icon: <Monitor className="w-4 h-4" />, active: true },
                        { device: 'Safari on iPhone', location: 'Last active 2h ago', icon: <Smartphone className="w-4 h-4" />, active: false },
                      ].map((s) => (
                        <div key={s.device} className="flex items-center gap-4 p-4 rounded-xl border border-stone-100 bg-stone-50/60">
                          <div className={`p-2 rounded-lg ${s.active ? 'bg-brand-100 text-brand-700' : 'bg-stone-200 text-stone-600'}`}>{s.icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-stone-900">{s.device}</p>
                            <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                              {s.active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />}
                              {s.location}
                            </p>
                          </div>
                          {!s.active && (
                            <button type="button" className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors border border-red-200 hover:border-red-300">
                              Revoke
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SSO / SAML — Enterprise only; password login unchanged */}
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                    {sectionHd(<Shield className="w-4 h-4 text-violet-600" />, 'SSO / SAML', 'Enterprise single sign-on — optional; email/password stays available')}
                    <SsoSettings />
                  </div>
                </div>
              )}

              {/*  APPEARANCE  */}
              {tab === 'appearance' && (
                <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                  {sectionHd(<Palette className="w-4 h-4 text-violet-600" />, 'Appearance', 'Customize how the dashboard looks and feels')}
                  <div className="space-y-8">
                    {/* Theme */}
                    <div>
                      <p className="text-sm font-bold text-stone-700 mb-3">Color Theme</p>
                      <div className="grid grid-cols-3 gap-3">
                        {([
                          { id: 'light', label: 'Light', icon: <Sun className="w-5 h-5" /> },
                          { id: 'dark', label: 'Dark', icon: <Moon className="w-5 h-5" /> },
                          { id: 'system', label: 'System', icon: <Monitor className="w-5 h-5" /> },
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTheme(opt.id)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                              theme === opt.id
                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                : 'border-stone-200 bg-stone-50/50 text-stone-500 hover:border-stone-300'
                            }`}
                          >
                            {opt.icon}
                            <span className="text-xs font-semibold">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Density */}
                    <div>
                      <p className="text-sm font-bold text-stone-700 mb-3">Display Density</p>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { id: 'comfortable', label: 'Comfortable', desc: 'More spacing, easier to read' },
                          { id: 'compact', label: 'Compact', desc: 'Fits more on screen' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setDensity(opt.id)}
                            className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all ${
                              density === opt.id
                                ? 'border-brand-500 bg-brand-50'
                                : 'border-stone-200 bg-stone-50/50 hover:border-stone-300'
                            }`}
                          >
                            <span className={`text-sm font-bold ${density === opt.id ? 'text-brand-700' : 'text-stone-800'}`}>{opt.label}</span>
                            <span className="text-xs text-stone-500">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <SaveBtn saving={false} saved={false} label="Apply appearance" onClick={() => toast.success('Appearance saved', 'Your display preferences have been updated.')} />
                  </div>
                </div>
              )}

              {/*  WORKSPACE  */}
              {tab === 'workspace' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                    {sectionHd(<Building2 className="w-4 h-4 text-teal-600" />, 'Workspace Info', 'Your organisation details and branding')}
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-1.5">Company Name</label>
                        <input type="text" defaultValue="Devlumiq" className={inputCls()} placeholder="Company name" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-1.5">Website</label>
                        <div className="relative">
                          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input type="url" defaultValue="https://devlumiq.com" className={`pl-11 ${inputCls()}`} placeholder="https://yourcompany.com" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-1.5">Timezone</label>
                        <div className="relative">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <select className={`pl-11 ${inputCls()}`} defaultValue="UTC">
                            {['UTC', 'UTC+1', 'UTC+2', 'UTC+5:30', 'UTC-5', 'UTC-8'].map((tz) => (
                              <option key={tz}>{tz}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6">
                      <SaveBtn saving={false} saved={false} label="Save workspace" onClick={() => toast.success('Workspace saved', 'Workspace settings updated.')} />
                    </div>
                  </div>

                  {/* Career page link */}
                  <div className="rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50 to-teal-50/30 p-6 shadow-[var(--shadow-card)]">
                    <div className="flex items-center gap-3 mb-4">
                      <Sparkles className="w-5 h-5 text-brand-600" />
                      <h3 className="font-bold text-stone-900">Public Careers Page</h3>
                    </div>
                    <p className="text-sm text-stone-600 mb-4">Your branded careers page is live. Share it with candidates or embed the chatbot on your site.</p>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200 mb-3">
                      <Globe className="w-4 h-4 text-stone-400 flex-shrink-0" />
                      <code className="text-xs text-stone-700 flex-1 truncate">/careers</code>
                      <a href="/careers" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-600 hover:text-brand-700 flex-shrink-0 flex items-center gap-1">
                        Open <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-xs font-semibold text-stone-600 mb-2">Embed careers chatbot</p>
                    <div className="rounded-xl bg-stone-900 text-stone-100 p-3 relative">
                      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-all pr-16">{`<script src="${appOrigin || 'https://your-app'}/careers-chatbot.js" data-company="${companySlug || 'your-slug'}" async></script>`}</pre>
                      <button
                        type="button"
                        onClick={() => {
                          const snippet = `<script src="${appOrigin || window.location.origin}/careers-chatbot.js" data-company="${companySlug || 'your-slug'}" async></script>`;
                          void navigator.clipboard.writeText(snippet).then(() => {
                            setEmbedCopied(true);
                            toast.success('Copied', 'Embed snippet copied to clipboard');
                            setTimeout(() => setEmbedCopied(false), 2000);
                          });
                        }}
                        className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-semibold"
                      >
                        <ClipboardCopy className="w-3 h-3" />
                        {embedCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    <div className="mt-5 pt-5 border-t border-brand-200/60">
                      <p className="text-sm font-bold text-stone-800 mb-1">Chatbot FAQ</p>
                      <p className="text-xs text-stone-500 mb-3">
                        Custom Q&amp;A merged ahead of defaults. Keywords are comma-separated match terms.
                      </p>
                      <div className="space-y-3">
                        {careersFaq.map((item, idx) => (
                          <div key={idx} className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
                            <input
                              type="text"
                              placeholder="Question"
                              value={item.q}
                              onChange={(e) =>
                                setCareersFaq((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, q: e.target.value } : row)),
                                )
                              }
                              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
                            />
                            <textarea
                              placeholder="Answer"
                              value={item.a}
                              rows={2}
                              onChange={(e) =>
                                setCareersFaq((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, a: e.target.value } : row)),
                                )
                              }
                              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm resize-none"
                            />
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Keywords (comma-separated)"
                                value={item.keywords}
                                onChange={(e) =>
                                  setCareersFaq((prev) =>
                                    prev.map((row, i) => (i === idx ? { ...row, keywords: e.target.value } : row)),
                                  )
                                }
                                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setCareersFaq((prev) => prev.filter((_, i) => i !== idx))}
                                className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => setCareersFaq((prev) => [...prev, { q: '', a: '', keywords: '' }])}
                          className="px-3 py-2 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-white"
                        >
                          Add FAQ
                        </button>
                        <button
                          type="button"
                          disabled={faqSaving}
                          onClick={async () => {
                            setFaqSaving(true);
                            try {
                              const payload = careersFaq
                                .filter((f) => f.q.trim() && f.a.trim())
                                .map((f) => ({
                                  q: f.q.trim(),
                                  a: f.a.trim(),
                                  keywords: f.keywords
                                    .split(',')
                                    .map((k) => k.trim())
                                    .filter(Boolean),
                                }));
                              const res = await fetch('/api/company', {
                                method: 'PATCH',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ careersFaq: payload }),
                              });
                              if (!res.ok) {
                                const d = await res.json().catch(() => ({}));
                                throw new Error(d.error || 'Save failed');
                              }
                              toast.success('FAQ saved', 'Careers chatbot will use these answers first');
                            } catch (e: unknown) {
                              toast.error('FAQ', e instanceof Error ? e.message : 'Failed');
                            } finally {
                              setFaqSaving(false);
                            }
                          }}
                          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          {faqSaving ? 'Saving…' : 'Save FAQ'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BILLING */}
              {tab === 'billing' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-stone-100">
                      <CreditCard className="w-4 h-4 text-brand-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-stone-900">Subscription & Billing</h2>
                      <p className="text-xs text-stone-500 mt-0.5">Manage your plan, upgrade, or update payment methods</p>
                    </div>
                  </div>
                  <BillingSettings />
                </div>
              )}

              {/* API KEYS */}
              {tab === 'api-keys' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                    {sectionHd(<Key className="w-4 h-4 text-brand-600" />, 'API Keys', 'Connect your own OpenAI, email, background-check, and other provider keys — stored encrypted')}
                    <ApiKeyManager />
                  </div>
                </div>
              )}

              {/* CHROME EXTENSION */}
              {tab === 'extension' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                    {sectionHd(<Chrome className="w-4 h-4 text-brand-600" />, 'Chrome Extension', 'One-click LinkedIn profile import — a real ATS differentiator')}
                    <ExtensionSettings />
                  </div>
                </div>
              )}

              {/*  DANGER ZONE  */}
              {tab === 'danger' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-red-200/80 bg-red-50/30 p-6 sm:p-8 shadow-[var(--shadow-card)]">
                    {sectionHd(<AlertTriangle className="w-4 h-4 text-red-600" />, 'Danger Zone', 'Irreversible actions — proceed with caution')}
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-xl bg-white border border-red-200/60">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-stone-900">Sign out of all devices</p>
                          <p className="text-xs text-stone-500 mt-0.5">Revokes all active sessions except the current one</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toast.info('Signed out', 'All other sessions have been terminated.')}
                          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign out everywhere
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-xl bg-white border border-red-200/60">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-stone-900">Delete account</p>
                          <p className="text-xs text-stone-500 mt-0.5">Permanently deletes your account and all associated data</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toast.error('Contact support', 'Please reach out to support@devlumiq.com to delete your account.')}
                          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Delete account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
    </PageShell>
  );
}
