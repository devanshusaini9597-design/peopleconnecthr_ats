import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Shield, Settings, Sparkles } from 'lucide-react';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { BASE, PROFILE_TOUR_KEY, PROFILE_TOUR_STEPS, PASSWORD_RULES } from './profileSettings/profileConstants';
import PersonalSection from './profileSettings/PersonalSection';
import SecuritySection from './profileSettings/SecuritySection';
import AccountSection from './profileSettings/AccountSection';
import IdentityHero from './profileSettings/IdentityHero';
import ProfileModals from './profileSettings/ProfileModals';
import SignedInDevices from './securitySettings/SignedInDevices';
import { useAuth } from '../context/AuthContext';
import { formatRoleLabel } from './organization/constants';

const blankProfile = () => ({
  name: '', email: '', phone: '', createdAt: null, lastLoginAt: null, isEmailVerified: false,
});

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user: authUser, organization, logout, updateUser } = useAuth();
  const isFreelancer = authUser?.role === 'freelancer';
  const [tourOpen, setTourOpen] = usePageTour(PROFILE_TOUR_KEY);

  const [profile, setProfile] = useState(blankProfile);
  const [originalProfile, setOriginalProfile] = useState(blankProfile);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

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
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const [stats, setStats] = useState({
    totalCandidates: 0, memberSince: null, lastLoginAt: null, isEmailVerified: false,
  });
  const [activeSection, setActiveSection] = useState('profile');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const userRole = authUser?.role || profile.role || '';
  const organizationName = organization?.name || '';

  useEffect(() => {
    fetchProfile();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyUser = (user) => ({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null,
    isEmailVerified: Boolean(user.isEmailVerified),
    role: user.role || '',
  });

  const fetchProfile = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/profile`);
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      if (data.success && data.user) {
        const next = applyUser(data.user);
        setProfile(next);
        setOriginalProfile(next);
        setProfilePicture(data.user.profilePicture || '');
        updateUser?.({
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          profilePicture: data.user.profilePicture || '',
          role: data.user.role,
          isEmailVerified: data.user.isEmailVerified,
        });
      } else {
        toast.error(data.message || 'Failed to load profile');
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
      if (data.success && data.stats) setStats(data.stats);
    } catch { /* silent */ }
  };

  const handleSaveProfile = async () => {
    if (!profile.name.trim()) { toast.error('Name is required'); return; }
    if (profile.phone && !/^\d{7,15}$/.test(profile.phone.replace(/\D/g, ''))) {
      toast.error('Enter a valid phone number'); return;
    }

    setIsSavingProfile(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/profile`, {
        method: 'PUT',
        body: JSON.stringify({ name: profile.name.trim(), phone: profile.phone.replace(/\D/g, '').trim() }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = {
          ...profile,
          name: data.user?.name || profile.name.trim(),
          phone: data.user?.phone ?? profile.phone.replace(/\D/g, '').trim(),
        };
        setOriginalProfile(updated);
        setProfile(updated);
        setIsEditingProfile(false);
        updateUser?.({ name: updated.name, phone: updated.phone });
        toast.success('Profile updated');
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
      const res = await authenticatedFetch(`${BASE}/api/profile/picture`, {
        method: 'PUT',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setProfilePicture(data.profilePicture);
        setPendingPhotoFile(null);
        setPendingPhotoPreview(null);
        updateUser?.({ profilePicture: data.profilePicture || '' });
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
        updateUser?.({ profilePicture: '' });
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', { detail: '' }));
        toast.success('Profile picture removed');
      } else {
        toast.error(data.message || 'Failed to remove picture');
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
    const failed = PASSWORD_RULES.find((rule) => !rule.test(passwordData.newPassword));
    if (failed) { toast.error(failed.label); return; }
    if (passwordData.newPassword !== passwordData.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (passwordData.currentPassword === passwordData.newPassword) {
      toast.error('New password must be different from the current password'); return;
    }

    setIsChangingPassword(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/profile/change-password`, {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Password updated');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        updateUser({ mustChangePassword: false });
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
    const email = (profile.email || '').trim();
    if (!email) {
      toast.error('No email on this account');
      return;
    }

    setIsRecovering(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setRecoverySuccess(true);
        toast.success('Password recovery email sent');
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
    setShowLogoutConfirm(false);
    logout();
  };

  const hasProfileChanges = profile.name !== originalProfile.name || profile.phone !== originalProfile.phone;

  const getPasswordStrength = (password) => {
    if (!password) return { level: 0, label: '', color: '' };
    const score = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
    if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { level: 2, label: 'Medium', color: 'bg-amber-500' };
    return { level: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    ...(!isFreelancer ? [{ id: 'account', label: 'Account', icon: Settings }] : []),
  ];

  const quickLinks = isFreelancer ? [] : [
    { path: '/email-settings', icon: Mail, title: 'Email Settings', desc: 'SMTP & delivery', tone: 'bg-sky-50 text-sky-600' },
    { path: '/email-templates', icon: Sparkles, title: 'Email Templates', desc: 'Hiring messages', tone: 'bg-violet-50 text-violet-600' },
  ];

  if (isLoadingProfile) {
    return (
      <div className="page-shell-ats max-w-5xl animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-36 skeleton-ats rounded-lg" />
            <div className="h-4 w-64 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="h-40 skeleton-ats rounded-2xl mt-4" />
        <div className="h-10 w-72 skeleton-ats rounded-xl mt-4" />
        <div className="h-64 skeleton-ats rounded-2xl mt-4" />
      </div>
    );
  }

  const initials = (profile.name
    ? profile.name.split(' ').map((w) => w[0]).join('').slice(0, 2)
    : (profile.email || 'U').slice(0, 2)
  ).toUpperCase();

  const subtitle = [profile.name, formatRoleLabel(userRole)].filter(Boolean).join(' · ');

  return (
    <div className="page-shell-ats max-w-5xl animate-page-enter">
      <PageHeader
        icon={User}
        title="Profile"
        subtitle={subtitle || 'Your account'}
        gradientTitle
      />

      <IdentityHero
        profile={profile}
        initials={initials}
        userRole={userRole}
        organizationName={organizationName}
        profilePicture={profilePicture}
        pendingPhotoPreview={pendingPhotoPreview}
        isUploadingPic={isUploadingPic}
        profilePicRef={profilePicRef}
        stats={stats}
        onUpload={handleUploadProfilePicture}
        onSavePhoto={handleSaveProfilePicture}
        onCancelPhoto={() => { setPendingPhotoFile(null); setPendingPhotoPreview(null); }}
        onRemovePhoto={handleRemoveProfilePicture}
      />

      <div
        data-tour="profile-tabs"
        className="flex items-center gap-1 p-1 bg-stone-100/80 rounded-xl w-full sm:w-auto overflow-x-auto"
      >
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

      {activeSection === 'profile' && (
        <PersonalSection
          isEditingProfile={isEditingProfile}
          setIsEditingProfile={setIsEditingProfile}
          profile={profile}
          setProfile={setProfile}
          hasProfileChanges={hasProfileChanges}
          isSavingProfile={isSavingProfile}
          handleCancelEditProfile={handleCancelEditProfile}
          handleSaveProfile={handleSaveProfile}
          isFreelancer={isFreelancer}
          organizationName={organizationName}
          userRole={userRole}
        />
      )}

      {activeSection === 'security' && (
        <div className="space-y-4">
          <SecuritySection
            accountEmail={profile.email}
            passwordData={passwordData}
            setPasswordData={setPasswordData}
            showCurrentPassword={showCurrentPassword}
            setShowCurrentPassword={setShowCurrentPassword}
            showNewPassword={showNewPassword}
            setShowNewPassword={setShowNewPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            passwordStrength={passwordStrength}
            isChangingPassword={isChangingPassword}
            handleChangePassword={handleChangePassword}
            onForgotPassword={() => { setRecoverySuccess(false); setShowRecoveryModal(true); }}
          />
          <SignedInDevices />
        </div>
      )}

      {activeSection === 'account' && !isFreelancer && (
        <AccountSection
          navigate={navigate}
          setShowLogoutConfirm={setShowLogoutConfirm}
          quickLinks={quickLinks}
        />
      )}

      <ProfileModals
        showRecoveryModal={showRecoveryModal}
        setShowRecoveryModal={setShowRecoveryModal}
        recoverySuccess={recoverySuccess}
        setRecoverySuccess={setRecoverySuccess}
        recoveryEmail={profile.email}
        isRecovering={isRecovering}
        handlePasswordRecovery={handlePasswordRecovery}
        showLogoutConfirm={showLogoutConfirm}
        setShowLogoutConfirm={setShowLogoutConfirm}
        handleLogoutAllDevices={handleLogoutAllDevices}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Profile" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={PROFILE_TOUR_STEPS}
        storageKey={PROFILE_TOUR_KEY}
      />
    </div>
  );
};

export default ProfileSettingsPage;
