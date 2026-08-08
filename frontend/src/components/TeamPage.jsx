import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Mail, Clock, Filter, Info, CheckCircle, X, Loader2, Search } from 'lucide-react';
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

  // Company domain info
  const [companyDomain, setCompanyDomain] = useState(null);
  const [isCompanyEmail, setIsCompanyEmail] = useState(null);
  const [emailError, setEmailError] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_MEMBER_FORM);

  // Delete state
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Invitation action state
  const [processingInvitation, setProcessingInvitation] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMembers(); fetchDomainInfo(); fetchPendingInvitations(); }, []);

  const fetchMembers = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/team`);
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      if (data.success) setMembers(data.members);
    } catch {
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
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
        toast.success('Invitation accepted! You are now part of the team.');
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

  const fetchDomainInfo = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/team/domain-info`);
      const data = await res.json();
      if (data.success) {
        setCompanyDomain(data.domainInfo);
      }
    } catch (err) {
      console.error('Failed to fetch domain info:', err);
    }
  };

  const checkEmailDomain = (email) => {
    setEmailError('');
    if (!email || !companyDomain?.domain) {
      setIsCompanyEmail(null);
      return;
    }
    const emailDomain = email.toLowerCase().split('@')[1];
    if (!emailDomain) {
      setIsCompanyEmail(null);
      setEmailError('Enter a valid email address.');
      return;
    }
    const isCompany = emailDomain === companyDomain.domain ||
      (companyDomain.allowedDomains || []).includes(emailDomain);
    setIsCompanyEmail(isCompany);
    if (!isCompany) {
      setEmailError(`Only @${companyDomain.domain} addresses are allowed. User must already have an account.`);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', role: 'Team Member', phone: '', department: '' });
    setEditingId(null);
    setShowForm(false);
    setEmailError('');
  };

  const handleEdit = (member) => {
    setFormData({ name: member.name, email: member.email, role: member.role || 'Team Member', phone: member.phone || '', department: member.department || '' });
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
    if (companyDomain?.domain) {
      const domain = companyDomain.domain.toLowerCase();
      const emailDomain = formData.email.trim().toLowerCase().split('@')[1];
      if (emailDomain !== domain) {
        setEmailError(`Only @${domain} addresses are allowed. User must already have an account.`);
        toast.error(`Only company email addresses (@${domain}) are allowed.`);
        return;
      }
    }
    setEmailError('');

    setIsSaving(true);
    try {
      const url = editingId ? `${BASE}/api/team/${editingId}` : `${BASE}/api/team`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await authenticatedFetch(url, { method, body: JSON.stringify(formData) });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchMembers();
        resetForm();
      } else {
        toast.error(data.message || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save team member');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (member) => {
    setDeleteConfirm(member);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm._id;
    setDeletingId(id);
    try {
      const res = await authenticatedFetch(`${BASE}/api/team/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Team member removed');
        setMembers(prev => prev.filter(m => m._id !== id));
      } else {
        toast.error(data.message || 'Failed to remove');
      }
    } catch {
      toast.error('Failed to remove team member');
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  };

  const filtered = filterMembers(members, searchQuery, activeTab);

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Users}
        title={t('pages.team.title')}
        subtitle="Add colleagues, managers & stakeholders — quickly CC/BCC them in emails."
        gradientTitle
      >
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary flex-1 sm:flex-none"
        >
          <Plus size={16} />
          <span className="whitespace-nowrap">Add Member</span>
        </button>
      </PageHeader>

      <div
        data-tour="team-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          Add contacts once — they appear as CC/BCC suggestions when you email candidates.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      {/* Pending invitations */}
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
                      Invitation from{' '}
                      <span className="text-brand-600">{inv.invitedBy ? 'a team member' : 'Unknown'}</span>
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Role: {inv.role || 'Team Member'}
                      {inv.department ? ` · ${inv.department}` : ''}
                    </p>
                    {inv.invitationMessage && (
                      <p className="text-xs text-stone-400 italic mt-1 line-clamp-2">&ldquo;{inv.invitationMessage}&rdquo;</p>
                    )}
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

      {/* Toolbar: search + filter chips */}
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
                placeholder="Search name, email, role, department…"
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

      <TeamMemberModal
        open={showForm}
        onClose={resetForm}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        emailError={emailError}
        setEmailError={setEmailError}
        companyDomain={companyDomain}
        checkEmailDomain={checkEmailDomain}
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
        onEdit={handleEdit}
        onDelete={confirmDelete}
        deletingId={deletingId}
      />

      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Remove Team Member"
        message={`Are you sure you want to remove "${deleteConfirm?.name}" from your team? This action cannot be undone.`}
        details={deleteConfirm && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-teal-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-xs">
                {deleteConfirm.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">{deleteConfirm.name}</p>
              <p className="text-xs text-stone-500">{deleteConfirm.email}</p>
            </div>
          </div>
        )}
        confirmText="Remove Member"
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
