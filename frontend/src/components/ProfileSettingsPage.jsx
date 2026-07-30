import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, Shield, Save, Eye, EyeOff, AlertCircle, CheckCircle, Loader2, Calendar, Database, Settings, ChevronRight, LogOut, X, Camera, Trash2 } from 'lucide-react';
import API_URL from '../config';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import Layout from './Layout';
import { formatNameForInput } from '../utils/textFormatter';

const BASE = API_URL;

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // Profile state
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [originalProfile, setOriginalProfile] = useState({ name: '', email: '', phone: '' });
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  // Profile picture state
  const [profilePicture, setProfilePicture] = useState('');
  const [isUploadingPic, setIsUploadingPic] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState(null);
  const profilePicRef = React.useRef(null);

  // Password state
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Password recovery state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // Stats state
  const [stats, setStats] = useState({ totalCandidates: 0, emailConfigured: false, memberSince: null });

  // Active section (for mobile)
  const [activeSection, setActiveSection] = useState('profile');

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
        body: JSON.stringify({ name: profile.name.trim(), phone: profile.phone.replace(/\D/g, '').trim() })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Profile updated successfully');
        const updated = { ...profile, name: profile.name.trim(), phone: profile.phone.replace(/\D/g, '').trim() };
        setOriginalProfile(updated);
        setProfile(updated);
        setIsEditingProfile(false);
        // Update localStorage + token
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

  const handleUploadProfilePicture = async (e) => {
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
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
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
        body: JSON.stringify({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword })
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
        body: JSON.stringify({ email: recoveryEmail })
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
    if (score <= 4) return { level: 2, label: 'Medium', color: 'bg-yellow-500' };
    return { level: 3, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  const sectionNav = [
    { id: 'profile', label: 'My Profile', icon: User, description: 'Personal information' },
    { id: 'security', label: 'Security', icon: Lock, description: 'Password & account' },
    { id: 'account', label: 'Account', icon: Settings, description: 'Preferences & data' },
  ];

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account settings and preferences</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
              <div className="flex flex-col items-center text-center">
                <div className="relative group mb-3">
                  {pendingPhotoPreview ? (
                    <img src={pendingPhotoPreview} alt="New profile" className="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-blue-300" />
                  ) : profilePicture ? (
                    <img
                      src={`${BASE}${profilePicture}`}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-white"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full flex items-center justify-center font-bold text-2xl shadow-lg">
                      {(profile.name ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2) : profile.email.slice(0, 2)).toUpperCase()}
                    </div>
                  )}
                  <button
                    onClick={() => profilePicRef.current?.click()}
                    disabled={isUploadingPic}
                    className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors border-2 border-white"
                    title="Choose photo"
                  >
                    {isUploadingPic ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                  </button>
                  <input ref={profilePicRef} type="file" accept="image/*" className="hidden" onChange={handleUploadProfilePicture} />
                  {!pendingPhotoPreview && profilePicture && (
                    <button
                      onClick={handleRemoveProfilePicture}
                      className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove photo"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
                {pendingPhotoPreview && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <button
                      onClick={handleSaveProfilePicture}
                      disabled={isUploadingPic}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {isUploadingPic ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save photo
                    </button>
                    <button
                      onClick={() => { setPendingPhotoFile(null); setPendingPhotoPreview(null); }}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <h3 className="text-base font-semibold text-gray-900">{profile.name || 'No Name'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{profile.email}</p>
                {stats.memberSince && (
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <Calendar size={12} />
                    Member since {new Date(stats.memberSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            {/* Section Navigation */}
            <nav className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {sectionNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-l-3 ${
                      activeSection === item.id
                        ? 'bg-blue-50 border-l-blue-600 text-blue-700'
                        : 'border-l-transparent text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} className={activeSection === item.id ? 'text-blue-600' : 'text-gray-400'} />
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.description}</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-gray-300" />
                  </button>
                );
              })}
            </nav>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mt-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Stats</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-2"><Database size={14} className="text-gray-400" /> Candidates</span>
                  <span className="text-sm font-bold text-gray-900">{stats.totalCandidates}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-2"><Mail size={14} className="text-gray-400" /> Email Setup</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stats.emailConfigured ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {stats.emailConfigured ? 'Configured' : 'Not Set'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 min-w-0">
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <User size={20} className="text-blue-600" />
                        Personal Information
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">Update your personal details</p>
                    </div>
                    {!isEditingProfile ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
                      >
                        <User size={16} />
                        Edit Profile
                      </button>
                    ) : null}
                  </div>
                  <div className="p-6 space-y-5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                      <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile(prev => ({ ...prev, name: formatNameForInput(e.target.value) }))}
                            onBlur={() => setProfile(prev => ({ ...prev, name: prev.name.trim() }))}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                            placeholder="Enter your full name"
                          />
                        ) : (
                          <div className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm">
                            {profile.name || '—'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Email (read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={profile.email}
                          disabled
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 flex items-center gap-1">
                          <Lock size={12} /> Cannot change
                        </span>
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        {isEditingProfile ? (
                          <input
                            type="tel"
                            value={profile.phone}
                            onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                            placeholder="Enter your phone number"
                          />
                        ) : (
                          <div className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm">
                            {profile.phone || '—'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Edit mode actions */}
                    {isEditingProfile && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        {hasProfileChanges && (
                          <p className="text-sm text-amber-600 flex items-center gap-1">
                            <AlertCircle size={14} /> You have unsaved changes
                          </p>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCancelEditProfile}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => hasProfileChanges && setShowSaveConfirmModal(true)}
                            disabled={!hasProfileChanges || isSavingProfile}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                              hasProfileChanges
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isSavingProfile ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Security Section */}
            {activeSection === 'security' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Lock size={20} className="text-blue-600" />
                      Change Password
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Ensure your account stays secure</p>
                  </div>
                  <div className="p-6 space-y-5">
                    {/* Current Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {/* Password Strength Meter */}
                      {passwordData.newPassword && (
                        <div className="mt-2">
                          <div className="flex gap-1 mb-1">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= passwordStrength.level ? passwordStrength.color : 'bg-gray-200'}`} />
                            ))}
                          </div>
                          <p className={`text-xs ${passwordStrength.level === 1 ? 'text-red-500' : passwordStrength.level === 2 ? 'text-yellow-600' : 'text-green-600'}`}>
                            Password strength: {passwordStrength.label}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">Min 8 chars with uppercase, lowercase, number, and special character</p>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle size={12} /> Passwords do not match
                        </p>
                      )}
                      {passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword && passwordData.newPassword && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle size={12} /> Passwords match
                        </p>
                      )}
                    </div>

                    {/* Change Password Button */}
                    <div className="pt-2">
                      <button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          passwordData.currentPassword && passwordData.newPassword && passwordData.confirmPassword
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {isChangingPassword ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                        {isChangingPassword ? 'Changing...' : 'Change Password'}
                      </button>
                    </div>

                    {/* Forgot Password Link */}
                    <div className="pt-3 border-t border-gray-100">
                      <button
                        onClick={() => setShowRecoveryModal(true)}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        <Lock size={14} />
                        Forgot password? Reset it without current password
                      </button>
                    </div>
                  </div>
                </div>

                {/* Security Tips */}
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                  <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2 mb-3">
                    <Shield size={16} /> Security Tips
                  </h3>
                  <ul className="space-y-2 text-sm text-blue-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                      Use a unique password you don't use on other sites
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                      Include a mix of letters, numbers, and symbols
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                      Avoid using personal information in your password
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Account Section */}
            {activeSection === 'account' && (
              <div className="space-y-6">
                {/* Account Overview */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Settings size={20} className="text-blue-600" />
                      Account Overview
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">View your account details and usage</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Database size={20} className="text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-blue-900">{stats.totalCandidates}</p>
                            <p className="text-xs text-blue-600">Total Candidates</p>
                          </div>
                        </div>
                      </div>
                      <div className={`rounded-xl p-4 border ${stats.emailConfigured ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200' : 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.emailConfigured ? 'bg-green-600' : 'bg-yellow-500'}`}>
                            <Mail size={20} className="text-white" />
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${stats.emailConfigured ? 'text-green-900' : 'text-yellow-900'}`}>
                              {stats.emailConfigured ? 'Active' : 'Not Set'}
                            </p>
                            <p className={`text-xs ${stats.emailConfigured ? 'text-green-600' : 'text-yellow-600'}`}>Email Integration</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                            <Calendar size={20} className="text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-purple-900">
                              {stats.memberSince ? new Date(stats.memberSince).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </p>
                            <p className="text-xs text-purple-600">Member Since</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Quick Links</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    <button onClick={() => navigate('/email-settings')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <Mail size={18} className="text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Email Settings</p>
                          <p className="text-xs text-gray-500">Configure SMTP for sending emails</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </button>
                    <button onClick={() => navigate('/email-templates')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <Mail size={18} className="text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Email Templates</p>
                          <p className="text-xs text-gray-500">Create and manage email templates</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </button>
                    <button onClick={() => navigate('/manage-positions')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <Database size={18} className="text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Manage Positions</p>
                          <p className="text-xs text-gray-500">Add or edit positions / job roles</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </button>
                    <button onClick={() => navigate('/manage-clients')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <User size={18} className="text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Manage Clients</p>
                          <p className="text-xs text-gray-500">Add or edit client companies</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </button>
                  </div>
                </div>

                {/* Session Management */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Shield size={20} className="text-blue-600" />
                      Session
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Log Out</p>
                        <p className="text-xs text-gray-500">Sign out of your account on this device</p>
                      </div>
                      <button
                        onClick={handleLogoutAllDevices}
                        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <LogOut size={14} />
                        Log Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Profile Confirmation Modal */}
      {showSaveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Save size={24} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Save changes?</h3>
                  <p className="text-sm text-gray-500 mt-1">Your name and phone number will be updated.</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowSaveConfirmModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Recovery Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Lock size={18} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Reset Password</h3>
                  <p className="text-xs text-gray-500">Recover your account without current password</p>
                </div>
              </div>
              <button onClick={() => setShowRecoveryModal(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {recoverySuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Email Sent!</h4>
                  <p className="text-sm text-gray-600">Check your email for password reset instructions</p>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Enter your email address and we'll send you a link to reset your password. This works even if you've forgotten your current password.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="Enter your registered email"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handlePasswordRecovery}
                    disabled={isRecovering || !recoveryEmail}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                      recoveryEmail
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isRecovering ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail size={16} />
                        Send Reset Link
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/80 flex-shrink-0">
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="w-full px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-all"
              >
                {recoverySuccess ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProfileSettingsPage;

