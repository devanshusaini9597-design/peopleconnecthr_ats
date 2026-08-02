import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, Lock, Shield, Save, Eye, EyeOff, AlertCircle, CheckCircle2,
  Loader2, Calendar, Database, Settings, ChevronRight, LogOut, Camera, Trash2,
  KeyRound, Briefcase, Building2, Pencil, BadgeCheck, Sparkles
} from 'lucide-react';
import API_URL from '../config';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { formatNameForInput } from '../utils/textFormatter';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';

const BASE = API_URL;

const FieldRow = ({ icon: Icon, label, hint, children, iconClass = 'bg-stone-100 text-stone-500' }) => (
  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5 py-4 first:pt-0 last:pb-0">
    <div className="flex items-center gap-3 sm:w-44 shrink-0 pt-0.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-stone-900 tracking-tight">{label}</p>
        {hint && <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">{hint}</p>}
      </div>
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [originalProfile, setOriginalProfile] = useState({ name: '', email: '', phone: '' });
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  const [profilePicture, setProfilePicture] = useState('');
  const [isUploadingPic, setIsUploadingPic] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState(null);
  const profilePicRef = useRef(null);

  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const [stats, setStats] = useState({ totalCandidates: 0, emailConfigured: false, memberSince: null });
  const [activeSection, setActiveSection] = useState('profile');

  const userRole = (localStorage.getItem('userRole') || localStorage.getItem('role') || 'member').replace(/_/g, ' ');

  useEffect(() => {
    fetchProfile();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/profile`);
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      if (data.success) {
        setProfile({ name: data.user.name || '', email: data.user.email || '', phone: data.user.phone || '' });
        setOriginalProfile({ name: data.user.name || '', email: data.user.email || '', phone: data.user.phone || '' });
        if (data.user.profilePicture) setProfilePicture(data.user.profilePicture);
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/profile/stats`);
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch { /* silent */ }
  };

  const handleSaveProfile = async () => {
    if (!profile.name.trim()) { toast.error('Name is required'); return; }
    if (profile.phone && !/^\d{7,15}$/.test(profile.phone.replace(/\D/g, ''))) {
      toast.error('Enter a valid phone number'); return;
    }

    setShowSaveConfirmModal(false);
    setIsSavingProfile(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/profile`, {
        method: 'PUT',
        body: JSON.stringify({ name: profile.name.trim(), phone: profile.phone.replace(/\D/g, '').trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Profile updated successfully');
        const updated = { ...profile, name: profile.name.trim(), phone: profile.phone.replace(/\D/g, '').trim() };
        setOriginalProfile(updated);
        setProfile(updated);
        setIsEditingProfile(false);
        localStorage.setItem('userName', data.user.name);
        if (data.token) localStorage.setItem('token', data.token);
      } else {
        toast.error(data.message || 'Failed to update profile');
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelEditProfile = () => {
    setProfile({ ...originalProfile });
    setIsEditingProfile(false);
  };

  const handleUploadProfilePicture = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) { toast.error('Only image files (JPG, PNG, GIF, WebP) are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }

    setPendingPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPendingPhotoPreview(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handleSaveProfilePicture = async () => {
    if (!pendingPhotoFile) return;
    setIsUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', pendingPhotoFile);
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE}/api/profile/picture`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setProfilePicture(data.profilePicture);
        setPendingPhotoFile(null);
        setPendingPhotoPreview(null);
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', { detail: data.profilePicture || '' }));
        toast.success('Profile picture saved');
      } else {
        toast.error(data.message || 'Failed to save picture');
      }
    } catch {
      toast.error('Failed to save profile picture');
    } finally {
      setIsUploadingPic(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    setIsUploadingPic(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/profile/picture`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProfilePicture('');
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', { detail: '' }));
        toast.success('Profile picture removed');
      }
    } catch {
      toast.error('Failed to remove picture');
    } finally {
      setIsUploadingPic(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword) { toast.error('Current password is required'); return; }
    if (!passwordData.newPassword) { toast.error('New password is required'); return; }
    if (passwordData.newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(passwordData.newPassword)) {
      toast.error('Password must include uppercase, lowercase, number, and special character'); return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) { toast.error('Passwords do not match'); return; }

    setIsChangingPassword(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/profile/change-password`, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Password changed successfully');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(data.message || 'Failed to change password');
      }
    } catch {
      toast.error('Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePasswordRecovery = async () => {
    if (!recoveryEmail) {
      toast.error('Please enter your email address');
      return;
    }

    setIsRecovering(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email: recoveryEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setRecoverySuccess(true);
        toast.success('Password recovery email sent');
        setTimeout(() => {
          setShowRecoveryModal(false);
          setRecoveryEmail('');
          setRecoverySuccess(false);
        }, 2000);
      } else {
        toast.error(data.message || 'Failed to send recovery email');
      }
    } catch {
      toast.error('Failed to process password recovery');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleLogoutAllDevices = () => {
    localStorage.clear();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const hasProfileChanges = profile.name !== originalProfile.name || profile.phone !== originalProfile.phone;

  const getPasswordStrength = (password) => {
    if (!password) return { level: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;
    if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { level: 2, label: 'Medium', color: 'bg-amber-500' };
    return { level: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'account', label: 'Account', icon: Settings },
  ];

  const quickLinks = [
    { path: '/email-settings', icon: Mail, title: 'Email Settings', desc: 'SMTP & delivery', tone: 'bg-sky-50 text-sky-600' },
    { path: '/email-templates', icon: Sparkles, title: 'Email Templates', desc: 'Hiring messages', tone: 'bg-violet-50 text-violet-600' },
    { path: '/manage-positions', icon: Briefcase, title: 'Positions', desc: 'Job roles', tone: 'bg-amber-50 text-amber-600' },
    { path: '/manage-clients', icon: Building2, title: 'Clients', desc: 'Companies', tone: 'bg-emerald-50 text-emerald-600' },
  ];

  if (isLoadingProfile) {
    return (
      <div className="page-shell-ats max-w-4xl animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-36 skeleton-ats rounded-lg" />
            <div className="h-4 w-64 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="h-36 skeleton-ats rounded-2xl mt-2" />
        <div className="h-10 w-72 skeleton-ats rounded-xl mt-4" />
        <div className="h-64 skeleton-ats rounded-2xl mt-4" />
      </div>
    );
  }

  const initials = (profile.name
    ? profile.name.split(' ').map((w) => w[0]).join('').slice(0, 2)
    : profile.email.slice(0, 2)
  ).toUpperCase();

  return (
    <div className="page-shell-ats max-w-4xl animate-page-enter">
      <PageHeader
        icon={User}
        title="Profile"
        subtitle="Your identity, security, and account preferences."
        gradientTitle
      />

      {/* Identity hero */}
      <div className="card-ats-bordered overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-transparent to-teal-50/30 pointer-events-none" />
        <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative group self-start">
            {pendingPhotoPreview ? (
              <img src={pendingPhotoPreview} alt="New profile" className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-md border-2 border-brand-200" />
            ) : profilePicture ? (
              <img
                src={`${BASE}${profilePicture}`}
                alt="Profile"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-md border-2 border-white"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-600 text-white flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-md">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => profilePicRef.current?.click()}
              disabled={isUploadingPic}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-white text-brand-600 rounded-xl flex items-center justify-center shadow-md border border-stone-200 hover:bg-brand-50 transition-colors"
              title="Change photo"
            >
              {isUploadingPic ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={profilePicRef} type="file" accept="image/*" className="hidden" onChange={handleUploadProfilePicture} />
            {!pendingPhotoPreview && profilePicture && (
              <button
                type="button"
                onClick={handleRemoveProfilePicture}
                className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-lg flex items-center justify-center shadow-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove photo"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">{profile.name || 'No Name'}</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                <BadgeCheck className="w-3 h-3" /> {userRole}
              </span>
            </div>
            <p className="text-sm text-stone-500 mt-1 flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0" /> {profile.email}
            </p>
            {pendingPhotoPreview && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleSaveProfilePicture}
                  disabled={isUploadingPic}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isUploadingPic ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save photo
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingPhotoFile(null); setPendingPhotoPreview(null); }}
                  className="btn-secondary !px-3 !py-1.5 !text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 border border-stone-200/80">
              <Database className="w-4 h-4 text-brand-500" />
              <div>
                <p className="text-sm font-bold text-stone-900 leading-none">{stats.totalCandidates}</p>
                <p className="text-[10px] text-stone-400 font-medium mt-0.5">Candidates</p>
              </div>
            </div>
            <div className="flex-1 sm:flex-none flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 border border-stone-200/80">
              <Mail className={`w-4 h-4 ${stats.emailConfigured ? 'text-emerald-500' : 'text-amber-500'}`} />
              <div>
                <p className="text-sm font-bold text-stone-900 leading-none">{stats.emailConfigured ? 'Ready' : 'Setup'}</p>
                <p className="text-[10px] text-stone-400 font-medium mt-0.5">Email</p>
              </div>
            </div>
            {stats.memberSince && (
              <div className="flex-1 sm:flex-none flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 border border-stone-200/80">
                <Calendar className="w-4 h-4 text-teal-500" />
                <div>
                  <p className="text-sm font-bold text-stone-900 leading-none">
                    {new Date(stats.memberSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-stone-400 font-medium mt-0.5">Joined</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-stone-100/80 rounded-xl w-full sm:w-auto overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                active
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Profile section */}
      {activeSection === 'profile' && (
        <div className="card-ats-bordered overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Personal information</h3>
                <p className="text-xs text-stone-500">How you appear across the ATS</p>
              </div>
            </div>
            {!isEditingProfile ? (
              <button type="button" onClick={() => setIsEditingProfile(true)} className="btn-primary">
                <Pencil size={15} /> Edit
              </button>
            ) : null}
          </div>

          <div className="px-5 sm:px-6 py-2 divide-y divide-stone-100">
            <FieldRow icon={User} label="Full name" hint="Shown on emails & activity" iconClass="bg-brand-50 text-brand-600">
              {isEditingProfile ? (
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, name: formatNameForInput(e.target.value) }))}
                  onBlur={() => setProfile((prev) => ({ ...prev, name: prev.name.trim() }))}
                  className="input-ats"
                  placeholder="Enter your full name"
                />
              ) : (
                <p className="text-sm font-medium text-stone-800 py-2.5">{profile.name || '—'}</p>
              )}
            </FieldRow>

            <FieldRow icon={Mail} label="Work email" hint="Sign-in identity" iconClass="bg-sky-50 text-sky-600">
              <div className="flex items-center gap-2 py-2.5">
                <p className="text-sm font-medium text-stone-600 truncate">{profile.email}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200 shrink-0">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              </div>
            </FieldRow>

            <FieldRow icon={Phone} label="Phone" hint="Optional contact number" iconClass="bg-teal-50 text-teal-600">
              {isEditingProfile ? (
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                  className="input-ats"
                  placeholder="Enter phone number"
                />
              ) : (
                <p className="text-sm font-medium text-stone-800 py-2.5">{profile.phone || 'Not added'}</p>
              )}
            </FieldRow>
          </div>

          {isEditingProfile && (
            <div className="px-5 sm:px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between gap-3 flex-wrap">
              {hasProfileChanges ? (
                <p className="text-sm text-amber-600 flex items-center gap-1.5 font-medium">
                  <AlertCircle size={14} /> Unsaved changes
                </p>
              ) : <span />}
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={handleCancelEditProfile} className="btn-secondary">Cancel</button>
                <button
                  type="button"
                  onClick={() => hasProfileChanges && setShowSaveConfirmModal(true)}
                  disabled={!hasProfileChanges || isSavingProfile}
                  className={`btn-primary ${!hasProfileChanges ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSavingProfile ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security */}
      {activeSection === 'security' && (
        <div className="space-y-4">
          <div className="card-ats-bordered overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Change password</h3>
                <p className="text-xs text-stone-500">Keep your account secure</p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="label-ats">Current password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    className="input-ats !pl-10 !pr-12"
                    placeholder="Enter current password"
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1">
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-ats">New password</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                      className="input-ats !pl-10 !pr-12"
                      placeholder="New password"
                    />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1">
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {passwordData.newPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= passwordStrength.level ? passwordStrength.color : 'bg-stone-200'}`} />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${
                        passwordStrength.level === 1 ? 'text-red-500'
                          : passwordStrength.level === 2 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {passwordStrength.label}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label-ats">Confirm password</label>
                  <div className="relative">
                    <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      className="input-ats !pl-10 !pr-12"
                      placeholder="Confirm password"
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1">
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {passwordData.confirmPassword && (
                    <p className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${
                      passwordData.newPassword === passwordData.confirmPassword ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {passwordData.newPassword === passwordData.confirmPassword
                        ? <><CheckCircle2 size={12} /> Passwords match</>
                        : <><AlertCircle size={12} /> Passwords do not match</>}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-stone-400">Min 8 characters with uppercase, lowercase, number, and special character.</p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(true)}
                  className="text-sm text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1.5 order-2 sm:order-1"
                >
                  <KeyRound size={14} /> Forgot password?
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  className={`btn-primary order-1 sm:order-2 ${
                    !(passwordData.currentPassword && passwordData.newPassword && passwordData.confirmPassword)
                      ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  {isChangingPassword ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                  {isChangingPassword ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Shield, title: 'Unique password', desc: 'Don’t reuse passwords from other sites' },
              { icon: KeyRound, title: 'Mix characters', desc: 'Letters, numbers, and symbols' },
              { icon: Lock, title: 'Stay private', desc: 'Avoid names, birthdays, or easy patterns' },
            ].map((tip) => (
              <div key={tip.title} className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-brand-600 mb-2.5">
                  <tip.icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-bold text-stone-900">{tip.title}</p>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account */}
      {activeSection === 'account' && (
        <div className="space-y-4">
          <div className="card-ats-bordered overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Shortcuts</h3>
                <p className="text-xs text-stone-500">Jump to related settings</p>
              </div>
            </div>
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 hover:border-brand-200 hover:bg-brand-50/30 transition-all text-left group"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${link.tone}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-900 tracking-tight">{link.title}</p>
                      <p className="text-xs text-stone-500">{link.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand-500 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card-ats-bordered overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900">Sign out</p>
                  <p className="text-xs text-stone-500 mt-0.5">End your session on this device</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogoutAllDevices}
                className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={showSaveConfirmModal}
        onClose={() => setShowSaveConfirmModal(false)}
        title="Save changes?"
        description="Your name and phone number will be updated."
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setShowSaveConfirmModal(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSaveProfile} disabled={isSavingProfile} className="btn-primary">
              {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save changes
            </button>
          </>
        }
      >
        <p className="text-sm text-stone-500 leading-relaxed">Confirm to apply your profile updates.</p>
      </Modal>

      <Modal
        open={showRecoveryModal}
        onClose={() => { setShowRecoveryModal(false); setRecoverySuccess(false); }}
        title="Reset password"
        description="Recover your account without your current password."
        size="sm"
        footer={
          <button
            type="button"
            onClick={() => { setShowRecoveryModal(false); setRecoverySuccess(false); }}
            className="btn-secondary w-full sm:w-auto"
          >
            {recoverySuccess ? 'Close' : 'Cancel'}
          </button>
        }
      >
        {recoverySuccess ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <h4 className="text-base font-bold text-stone-900 mb-1">Email sent</h4>
            <p className="text-sm text-stone-500">Check your inbox for reset instructions</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3.5">
              <p className="text-sm text-brand-800 leading-relaxed">
                Enter your email and we&apos;ll send a reset link — even if you&apos;ve forgotten your password.
              </p>
            </div>
            <div>
              <label className="label-ats">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="input-ats !pl-10"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handlePasswordRecovery}
              disabled={isRecovering || !recoveryEmail}
              className={`btn-primary w-full ${!recoveryEmail ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {isRecovering ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Mail size={16} /> Send reset link</>}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProfileSettingsPage;
