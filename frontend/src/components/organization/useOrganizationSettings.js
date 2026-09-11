import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../../config';
import usePageTour from '../../hooks/usePageTour';
import { useToast } from '../Toast';
import { useAuth } from '../../context/AuthContext';
import {
  detectBrowserTimezone,
  countryForCurrency,
} from '../../data/locales';
import { ORG_TOUR_KEY } from './constants';

export default function useOrganizationSettings() {
  const toast = useToast();
  const navigate = useNavigate();
  const { updateOrganization } = useAuth();
  const logoInputRef = useRef(null);
  const [tourOpen, setTourOpen] = usePageTour(ORG_TOUR_KEY);
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoDragging, setLogoDragging] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [mergeTarget, setMergeTarget] = useState(null);
  const [mergePartner, setMergePartner] = useState('');
  const [mergeName, setMergeName] = useState('');
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
  const [inviteReportsTo, setInviteReportsTo] = useState('');
  const [customRoleUpdatingId, setCustomRoleUpdatingId] = useState(null);
  const [reportsToUpdatingId, setReportsToUpdatingId] = useState(null);
  /** Last invite share panel: { email, inviteUrl, emailSent, emailError, userId } */
  const [lastInviteShare, setLastInviteShare] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [inviteShare, setInviteShare] = useState(null);
  const [inviteLinkLoadingId, setInviteLinkLoadingId] = useState(null);

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
    const target = stages[index];
    if (String(target || '').trim().toLowerCase() === 'rejected') {
      toast.error('Rejected stays on the pipeline so reports keep that stage');
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

  const applyPipelineStages = (stages) => {
    patchAts({ pipelineStages: stages });
  };

  const handleRenamePipelineStage = async () => {
    const oldName = renameTarget;
    const newName = renameDraft.trim();
    if (!oldName || !newName) {
      toast.error('Enter a stage name');
      return;
    }
    if (oldName.toLowerCase() === newName.toLowerCase()) {
      setRenameTarget(null);
      return;
    }
    setPipelineBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/organization/pipeline/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldName, newName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to rename stage');
      }
      applyPipelineStages(data.data?.stages || []);
      const n = data.data?.candidatesUpdated || 0;
      toast.success(n > 0 ? `Stage renamed — ${n} candidate${n === 1 ? '' : 's'} updated` : 'Stage renamed');
      setRenameTarget(null);
      setRenameDraft('');
    } catch (err) {
      toast.error(err.message || 'Failed to rename stage');
    } finally {
      setPipelineBusy(false);
    }
  };

  const handleMergePipelineStages = async () => {
    const first = mergeTarget;
    const second = mergePartner;
    const newName = mergeName.trim();
    if (!first || !second) {
      toast.error('Select two stages to merge');
      return;
    }
    if (!newName) {
      toast.error('Enter a name for the merged stage');
      return;
    }
    if (first.toLowerCase() === second.toLowerCase()) {
      toast.error('Select two different stages');
      return;
    }
    setPipelineBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/organization/pipeline/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceNames: [first, second], newName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to merge stages');
      }
      applyPipelineStages(data.data?.stages || []);
      const n = data.data?.candidatesUpdated || 0;
      toast.success(n > 0 ? `Stages merged — ${n} candidate${n === 1 ? '' : 's'} combined` : 'Stages merged');
      setMergeTarget(null);
      setMergePartner('');
      setMergeName('');
    } catch (err) {
      toast.error(err.message || 'Failed to merge stages');
    } finally {
      setPipelineBusy(false);
    }
  };

  const openRenameStage = (stage) => {
    setRenameTarget(stage);
    setRenameDraft(stage);
  };

  const openMergeStage = (stage) => {
    setMergeTarget(stage);
    setMergePartner('');
    setMergeName(stage);
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
    const pipelineStages = Array.isArray(ats.pipelineStages) && ats.pipelineStages.length
      ? [...ats.pipelineStages]
      : ['Sourced', 'Applied', 'Phone Screen', 'Interview', 'Offer', 'Hired'];
    // Keep Rejected visible in org pipeline + dashboard (do not invent other stages)
    if (!pipelineStages.some((s) => String(s || '').trim().toLowerCase() === 'rejected')) {
      pipelineStages.push('Rejected');
    }
    return {
      name: payload?.name || '',
      domain: payload?.domain || '',
      logo: payload?.logo || '',
      timezone,
      currency,
      country: countryForCurrency(currency) || 'US',
      dateFormat: settings.dateFormat || payload?.dateFormat || 'MM/DD/YYYY',
      atsSettings: {
        pipelineStages,
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

  const applyOrgIdentity = (patch) => {
    updateOrganization(patch);
    window.dispatchEvent(new CustomEvent('orgDataUpdated', { detail: patch }));
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
    reader.onload = async () => {
      const preview = String(reader.result || '');
      if (preview) {
        setOrg((prev) => ({ ...prev, logo: preview }));
        applyOrgIdentity({ logo: preview });
      }
      try {
        const form = new FormData();
        form.append('logo', file);
        const res = await fetch(`${API_URL}/api/organization/logo`, {
          method: 'PUT',
          credentials: 'include',
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to upload logo');
        const logo = data.logo || data.data?.logo || preview;
        setOrg((prev) => ({ ...prev, logo }));
        applyOrgIdentity({ logo });
        toast.success('Logo updated');
      } catch (err) {
        toast.success('Logo ready — click Save Changes to apply');
      }
    };
    reader.onerror = () => toast.error('Failed to read logo file');
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setOrg((prev) => ({ ...prev, logo: '' }));
    applyOrgIdentity({ logo: '' });
    try {
      await fetch(`${API_URL}/api/organization/logo`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch { /* local preview already cleared */ }
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
      const saved = await res.json().catch(() => ({}));
      const savedOrg = saved?.data || {};
      const identity = {
        name: savedOrg.name || org.name,
        logo: savedOrg.logo !== undefined ? savedOrg.logo : org.logo,
        domain: savedOrg.domain !== undefined ? savedOrg.domain : org.domain,
      };
      setOrg((prev) => ({ ...prev, name: identity.name, logo: identity.logo, domain: identity.domain }));
      applyOrgIdentity(identity);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyInviteLink = async (url) => {
    if (!url) return false;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied');
      return true;
    } catch {
      toast.error('Could not copy — select the link and copy manually');
      return false;
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
          reportsTo: inviteReportsTo || null,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to send invite');
      }

      const share = {
        email: data.email || email,
        inviteUrl: data.inviteUrl || '',
        emailSent: data.emailSent !== false,
        emailError: data.emailError || null,
        userId: data.userId || null,
      };
      setLastInviteShare(share.inviteUrl ? share : null);

      if (data.emailSent === false) {
        toast.warning('Invite created — email could not be sent. Share the link below.');
      } else {
        toast.success(`Invitation sent to ${email}`);
      }
      setInviteEmail('');
      setInviteCustomRoleId('');
      setInviteReportsTo('');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleGetMemberInviteLink = async (memberId) => {
    if (!memberId) return;
    setInviteLinkLoadingId(memberId);
    try {
      const res = await fetch(`${API_URL}/api/organization/members/${memberId}/invite-link`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Could not get invite link');
      }
      const payload = data.data || {};
      setInviteShare({
        email: payload.email || '',
        name: payload.name || '',
        inviteUrl: payload.inviteUrl || '',
      });
      if (!payload.inviteUrl) {
        toast.error('No invitation link is available for this person.');
      }
    } catch (err) {
      toast.error(err.message || 'Could not get invite link');
    } finally {
      setInviteLinkLoadingId(null);
    }
  };

  const handleChangeMemberReportsTo = async (memberId, reportsTo) => {
    setReportsToUpdatingId(memberId);
    try {
      const res = await fetch(`${API_URL}/api/organization/members/${memberId}/reports-to`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reportsTo: reportsTo || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to update reporting line');
      }
      toast.success(reportsTo ? 'Reporting line updated' : 'Reporting line cleared');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to update reporting line');
    } finally {
      setReportsToUpdatingId(null);
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

  const handleResetMemberPassword = async () => {
    if (!resetTarget?._id) return;
    setResetting(true);
    try {
      const res = await fetch(`${API_URL}/api/organization/members/${resetTarget._id}/reset-password`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to reset password');
      }
      const payload = data.data || null;
      setResetTarget(null);
      setResetResult(payload);
      if (payload?.emailSent) {
        toast.success(`Temporary password emailed to ${payload.email}`);
      } else {
        toast.success('Temporary password created. Email could not be sent — share it privately.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const handleResendTemporaryPassword = async ({ userId, temporaryPassword }) => {
    const res = await fetch(`${API_URL}/api/organization/members/${userId}/resend-temporary-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temporaryPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'Failed to send email');
    }
    return data.data;
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
    inviteReportsTo,
    setInviteReportsTo,
    customRoleUpdatingId,
    reportsToUpdatingId,
    lastInviteShare,
    setLastInviteShare,
    inviteLinkLoadingId,
    copyInviteLink,
    handleGetMemberInviteLink,
    addPipelineStage,
    removePipelineStage,
    movePipelineStage,
    pipelineBusy,
    renameTarget,
    setRenameTarget,
    renameDraft,
    setRenameDraft,
    mergeTarget,
    setMergeTarget,
    mergePartner,
    setMergePartner,
    mergeName,
    setMergeName,
    openRenameStage,
    openMergeStage,
    handleRenamePipelineStage,
    handleMergePipelineStages,
    fetchOrgData,
    processLogoFile,
    handleRemoveLogo,
    handleLogoDrop,
    handleSave,
    handleInvite,
    handleChangeMemberRole,
    handleChangeMemberCustomRole,
    handleChangeMemberReportsTo,
    handleRemoveMember,
    resetTarget,
    setResetTarget,
    resetting,
    resetResult,
    setResetResult,
    inviteShare,
    setInviteShare,
    handleResetMemberPassword,
    handleResendTemporaryPassword,
    applyDetectedTimezone,
  };
}
