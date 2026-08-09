import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../../config';
import usePageTour from '../../hooks/usePageTour';
import { useToast } from '../Toast';
import {
  detectBrowserTimezone,
  countryForCurrency,
} from '../../data/locales';
import { ORG_TOUR_KEY } from './constants';

export default function useOrganizationSettings() {
  const toast = useToast();
  const navigate = useNavigate();
  const logoInputRef = useRef(null);
  const [tourOpen, setTourOpen] = usePageTour(ORG_TOUR_KEY);
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoDragging, setLogoDragging] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);
  const [customRoles, setCustomRoles] = useState([]);
  const [customRolesLoading, setCustomRolesLoading] = useState(false);
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
  const [inviteRole, setInviteRole] = useState('hr_recruiter');
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState('');
  const [customRoleUpdatingId, setCustomRoleUpdatingId] = useState(null);

  const patchAts = (patch) => {
    setOrg((prev) => ({
      ...prev,
      atsSettings: { ...prev.atsSettings, ...patch },
    }));
  };

  const addPipelineStage = () => {
    const name = newStage.trim();
    if (!name) return;
    const stages = org.atsSettings.pipelineStages || [];
    if (stages.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast.error('That stage already exists');
      return;
    }
    patchAts({ pipelineStages: [...stages, name] });
    setNewStage('');
  };

  const removePipelineStage = (index) => {
    const stages = org.atsSettings.pipelineStages || [];
    if (stages.length <= 1) {
      toast.error('Keep at least one pipeline stage');
      return;
    }
    patchAts({ pipelineStages: stages.filter((_, i) => i !== index) });
  };

  const movePipelineStage = (from, to) => {
    if (from === to || from == null || to == null) return;
    const stages = [...(org.atsSettings.pipelineStages || [])];
    if (from < 0 || to < 0 || from >= stages.length || to >= stages.length) return;
    const [item] = stages.splice(from, 1);
    stages.splice(to, 0, item);
    patchAts({ pipelineStages: stages });
  };

  useEffect(() => {
    const onCollapse = (e) => setSidebarCollapsed(!!e.detail);
    window.addEventListener('sidebarCollapsed', onCollapse);
    return () => window.removeEventListener('sidebarCollapsed', onCollapse);
  }, []);

  useEffect(() => {
    fetchOrgData();
    if (activeTab === 'team') {
      fetchMembers();
      fetchCustomRoles();
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
      const res = await fetch(`${API_URL}/api/organization`, {
        credentials: 'include'
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
      const res = await fetch(`${API_URL}/api/organization/members`, {
        credentials: 'include'
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

  const fetchCustomRoles = async () => {
    setCustomRolesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/custom-roles`, {
        credentials: 'include'
      });
      if (res.status === 403) {
        setCustomRoles([]);
        return;
      }
      if (!res.ok) {
        setCustomRoles([]);
        return;
      }
      const data = await res.json();
      setCustomRoles(data.success ? (data.data || []) : []);
    } catch {
      setCustomRoles([]);
    } finally {
      setCustomRolesLoading(false);
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
          'Content-Type': 'application/json'
        },
        credentials: 'include',
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
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error('Enter an email address');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(`${API_URL}/api/onboarding/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          role: inviteRole,
          customRoleId: inviteCustomRoleId || null,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to send invite');
      }
      if (data.emailSent === false) {
        const link = data.inviteUrl ? ` Link: ${data.inviteUrl}` : '';
        toast.warning(
          `Invite saved, but email failed${data.emailError ? `: ${data.emailError}` : '.'}${link}`
        );
      } else {
        toast.success(`Invitation sent to ${email}`);
      }
      setInviteEmail('');
      setInviteCustomRoleId('');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeMemberRole = async (memberId, role) => {
    if (!role) return;
    setRoleUpdatingId(memberId);
    try {
      const res = await fetch(`${API_URL}/api/organization/members/${memberId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ role })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to update role');
      }
      toast.success('Role updated');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to update role');
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleChangeMemberCustomRole = async (memberId, customRoleId) => {
    setCustomRoleUpdatingId(memberId);
    try {
      const res = await fetch(`${API_URL}/api/organization/members/${memberId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ customRoleId: customRoleId || null })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to update permission pack');
      }
      toast.success(customRoleId ? 'Custom role assigned' : 'Using system role permissions');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to update permission pack');
    } finally {
      setCustomRoleUpdatingId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget?._id) return;
    setRemoving(true);
    try {
      const res = await fetch(`${API_URL}/api/organization/members/${removeTarget._id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to remove member');
      }
      toast.success('Member removed');
      setRemoveTarget(null);
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to remove member');
    } finally {
      setRemoving(false);
    }
  };

  const applyDetectedTimezone = () => {
    const tz = detectBrowserTimezone();
    setOrg((prev) => ({ ...prev, timezone: tz }));
    toast.success(`Timezone set to ${tz}`);
  };

  return {
    navigate,
    logoInputRef,
    tourOpen,
    setTourOpen,
    activeTab,
    setActiveTab,
    loading,
    saving,
    logoDragging,
    setLogoDragging,
    sidebarCollapsed,
    newStage,
    setNewStage,
    dragIndex,
    setDragIndex,
    inviting,
    removeTarget,
    setRemoveTarget,
    removing,
    roleUpdatingId,
    customRoles,
    customRolesLoading,
    detectedTz,
    org,
    setOrg,
    members,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviteCustomRoleId,
    setInviteCustomRoleId,
    customRoleUpdatingId,
    addPipelineStage,
    removePipelineStage,
    movePipelineStage,
    fetchOrgData,
    processLogoFile,
    handleLogoDrop,
    handleSave,
    handleInvite,
    handleChangeMemberRole,
    handleChangeMemberCustomRole,
    handleRemoveMember,
    applyDetectedTimezone,
  };
}
