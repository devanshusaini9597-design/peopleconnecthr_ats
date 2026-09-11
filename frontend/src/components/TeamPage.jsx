import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, Plus, Mail, Clock, Filter, Info, CheckCircle, X, Loader2, Search, UserPlus,
  Copy, Link2, MessageCircle, ExternalLink, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import API_URL from '../config';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  TEAM_TOUR_KEY,
  TEAM_TOUR_STEPS,
  FILTER_TABS,
  EMPTY_MEMBER_FORM,
  filterMembers,
  getTabCount,
} from './team/teamConstants';
import TeamMemberModal from './team/TeamMemberModal';
import TeamInviteModal from './team/TeamInviteModal';
import TeamMemberList from './team/TeamMemberList';

const BASE = API_URL;

const TeamPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(TEAM_TOUR_KEY);
  const [members, setMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_MEMBER_FORM);
  const [emailError, setEmailError] = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('hr_recruiter');
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState('');
  const [inviteReportsTo, setInviteReportsTo] = useState('');
  const [customRoles, setCustomRoles] = useState([]);
  const [orgSeats, setOrgSeats] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [lastInviteShare, setLastInviteShare] = useState(null);
  const [inviteLinkLoadingId, setInviteLinkLoadingId] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [processingInvitation, setProcessingInvitation] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMembers(); fetchPendingInvitations(); fetchCustomRoles(); fetchOrgSeats(); }, []);

  const fetchMembers = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/team`);
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      if (data.success) setMembers(data.members || []);
    } catch {
      toast.error('Failed to load team directory');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomRoles = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/custom-roles`);
      if (!res.ok) return;
      const data = await res.json();
      setCustomRoles(data.success ? (data.data || []) : []);
    } catch { /* optional */ }
  };

  const fetchOrgSeats = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/organization/members`);
      if (!res.ok) return;
      const data = await res.json();
      setOrgSeats(data.success ? (data.data || []) : []);
    } catch { /* optional */ }
  };

  const fetchPendingInvitations = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/team/pending`);
      const data = await res.json();
      if (data.success) setPendingInvitations(data.invitations || []);
    } catch { /* silent */ }
  };

  const handleAcceptInvitation = async (id) => {
    setProcessingInvitation(id);
    try {
      const res = await authenticatedFetch(`${BASE}/api/team/accept-invitation/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Invitation accepted.');
        fetchPendingInvitations();
        fetchMembers();
      } else {
        toast.error(data.message || 'Failed to accept invitation');
      }
    } catch { toast.error('Failed to accept invitation'); }
    finally { setProcessingInvitation(null); }
  };

  const handleDeclineInvitation = async (id) => {
    setProcessingInvitation(id);
    try {
      const res = await authenticatedFetch(`${BASE}/api/team/decline-invitation/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Invitation declined.');
        fetchPendingInvitations();
      } else {
        toast.error(data.message || 'Failed to decline invitation');
      }
    } catch { toast.error('Failed to decline invitation'); }
    finally { setProcessingInvitation(null); }
  };

  const copyInviteLink = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleWorkspaceInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error('Enter an email address');
      return;
    }
    setInviting(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/onboarding/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: inviteRole,
          customRoleId: inviteCustomRoleId || null,
          reportsTo: inviteReportsTo || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to send invite');
      }
      const share = {
        email: data.email || email,
        inviteUrl: data.inviteUrl || '',
        emailSent: data.emailSent !== false,
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
      setShowInvite(false);
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
      const res = await authenticatedFetch(`${BASE}/api/organization/members/${memberId}/invite-link`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Could not get invite link');
      }
      const payload = data.data || {};
      setLastInviteShare({
        email: payload.email || '',
        inviteUrl: payload.inviteUrl || '',
        emailSent: false,
      });
      if (payload.inviteUrl) await copyInviteLink(payload.inviteUrl);
    } catch (err) {
      toast.error(err.message || 'Could not get invite link');
    } finally {
      setInviteLinkLoadingId(null);
    }
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_MEMBER_FORM });
    setEditingId(null);
    setShowForm(false);
    setEmailError('');
  };

  const handleEdit = (member) => {
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role || 'Hiring Manager',
      phone: member.phone || '',
      department: member.department || '',
    });
    setEditingId(member._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (!formData.email.trim()) { toast.error('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email)) {
      setEmailError('Enter a valid email address.');
      toast.error('Enter a valid email');
      return;
    }
    setEmailError('');
    setIsSaving(true);
    try {
      const url = editingId ? `${BASE}/api/team/${editingId}` : `${BASE}/api/team`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await authenticatedFetch(url, { method, body: JSON.stringify(formData) });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Saved');
        fetchMembers();
        resetForm();
      } else {
        toast.error(data.message || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save stakeholder');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm._id;
    setDeletingId(id);
    try {
      const res = await authenticatedFetch(`${BASE}/api/team/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Stakeholder removed');
        setMembers((prev) => prev.filter((m) => m._id !== id));
      } else {
        toast.error(data.message || 'Failed to remove');
      }
    } catch {
      toast.error('Failed to remove stakeholder');
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  };

  const filtered = filterMembers(members, searchQuery, activeTab);
  const share = lastInviteShare;
  const shareUrl = (share?.inviteUrl || '').trim();
  const inviteeEmail = (share?.email || '').trim().toLowerCase();

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Users}
        title={t('pages.team.title')}
        subtitle="People with Skillnix access, plus stakeholders you CC on candidate mail."
        gradientTitle
      >
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-secondary flex-1 sm:flex-none"
        >
          <Plus size={16} />
          <span className="whitespace-nowrap">Add stakeholder</span>
        </button>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="btn-primary flex-1 sm:flex-none"
        >
          <UserPlus size={16} />
          <span className="whitespace-nowrap">Invite teammate</span>
        </button>
      </PageHeader>

      <div
        data-tour="team-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Workflow
        </span>
        <span>
          <span className="font-semibold text-stone-800">Invite teammate</span> grants a login and role.
          <span className="font-semibold text-stone-800"> Add stakeholder</span> is directory-only (CC/BCC, no seat).
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      {shareUrl && (
        <div
          className={`card-ats-bordered overflow-hidden p-4 sm:p-5 ${
            share.emailSent
              ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/30'
              : 'border-amber-200 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/20'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                share.emailSent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {share.emailSent ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-900 tracking-tight">
                  {share.emailSent ? 'Invitation sent' : 'Invite created — share the link'}
                </p>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  {inviteeEmail ? `Sent to ${inviteeEmail}. ` : ''}
                  They must join with that email — not a new signup.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLastInviteShare(null)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-white/80"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
              <Link2 size={14} className="text-brand-600 flex-shrink-0" />
              <input
                readOnly
                value={shareUrl}
                className="flex-1 min-w-0 bg-transparent text-[12px] font-medium text-stone-700 outline-none truncate"
                onFocus={(e) => e.target.select()}
              />
            </div>
            <button
              type="button"
              onClick={() => copyInviteLink(shareUrl)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-teal-600"
            >
              <Copy size={15} />
              Copy link
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {inviteeEmail && (
              <a
                href={`mailto:${inviteeEmail}?subject=${encodeURIComponent('Your team invitation')}&body=${encodeURIComponent(`Accept your invitation:\n${shareUrl}`)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-brand-300"
              >
                <Mail size={13} />
                Email
              </a>
            )}
            <button
              type="button"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`You're invited.\n${shareUrl}`)}`, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-emerald-300"
            >
              <MessageCircle size={13} />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
            >
              <ExternalLink size={13} />
              Open invite page
            </button>
          </div>
        </div>
      )}

      {pendingInvitations.length > 0 && (
        <div className="card-ats-bordered overflow-hidden border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40">
          <div className="px-5 sm:px-6 py-4 border-b border-amber-100/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
              <Clock size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-amber-900 tracking-tight">Pending invitations</h3>
              <p className="text-xs text-amber-700/80 font-medium mt-0.5">
                {pendingInvitations.length} invite{pendingInvitations.length !== 1 ? 's' : ''} waiting for your response
              </p>
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            {pendingInvitations.map((inv) => (
              <div
                key={inv._id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white rounded-2xl border border-amber-100/90 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm flex-shrink-0 ring-2 ring-amber-100">
                    <Mail size={16} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">
                      Directory invitation
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Role: {inv.role || 'Team Member'}
                      {inv.department ? ` · ${inv.department}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 sm:pl-2">
                  <button
                    type="button"
                    onClick={() => handleAcceptInvitation(inv._id)}
                    disabled={processingInvitation === inv._id}
                    className="btn-primary !text-xs !px-4 !py-2 flex-1 sm:flex-none !from-emerald-600 !via-emerald-600 !to-emerald-700"
                  >
                    {processingInvitation === inv._id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeclineInvitation(inv._id)}
                    disabled={processingInvitation === inv._id}
                    className="btn-secondary !text-xs !px-4 !py-2 flex-1 sm:flex-none"
                  >
                    <X size={13} />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(members.length > 0 || isLoading) && (
        <section
          data-tour="team-filters"
          className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            <div className="relative flex-1 min-w-0 max-w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, role…"
                className="input-ats input-ats-icon"
                disabled={isLoading || members.length === 0}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
                <Filter size={14} /> Filter
              </div>
              {FILTER_TABS.map((tab) => {
                const count = getTabCount(members, tab.key);
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    disabled={isLoading || members.length === 0}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                      active
                        ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
                    }`}
                  >
                    <Icon size={13} className={active ? 'text-white' : 'text-stone-400'} />
                    {tab.label}
                    {count > 0 && <span className="opacity-70">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <TeamInviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        customRoles={customRoles}
        inviteCustomRoleId={inviteCustomRoleId}
        setInviteCustomRoleId={setInviteCustomRoleId}
        inviteReportsTo={inviteReportsTo}
        setInviteReportsTo={setInviteReportsTo}
        managerOptions={[
          { value: '', label: 'No manager', description: 'Does not report to anyone' },
          ...orgSeats
            .filter((m) => m.isActive !== false)
            .map((m) => ({
              value: m._id,
              label: m.name || m.email,
              description: m.email,
            })),
        ]}
        onSubmit={handleWorkspaceInvite}
        inviting={inviting}
      />

      <TeamMemberModal
        open={showForm}
        onClose={resetForm}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        emailError={emailError}
        setEmailError={setEmailError}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <TeamMemberList
        isLoading={isLoading}
        members={members}
        filtered={filtered}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setActiveTab={setActiveTab}
        onAddFirst={() => { resetForm(); setShowForm(true); }}
        onInvite={() => setShowInvite(true)}
        onEdit={handleEdit}
        onDelete={setDeleteConfirm}
        deletingId={deletingId}
        onCopyInviteLink={handleGetMemberInviteLink}
        inviteLinkLoadingId={inviteLinkLoadingId}
      />

      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Remove stakeholder"
        message={`Remove "${deleteConfirm?.name}" from the directory? They will no longer appear in CC/BCC suggestions.`}
        details={deleteConfirm && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-teal-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-xs">
                {String(deleteConfirm.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">{deleteConfirm.name}</p>
              <p className="text-xs text-stone-500">{deleteConfirm.email}</p>
            </div>
          </div>
        )}
        confirmText="Remove"
        type="delete"
        isLoading={!!deletingId}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Team Directory" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={TEAM_TOUR_STEPS}
        storageKey={TEAM_TOUR_KEY}
      />
    </div>
  );
};

export default TeamPage;
