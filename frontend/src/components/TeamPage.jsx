import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Mail, Phone, Briefcase, X, Save, Loader2, Search, Building2, CheckCircle, Clock, UsersRound, Handshake, BarChart3, Target, Filter, UserCog, Shield } from 'lucide-react';
import API_URL from '../config';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import PremiumSelect from './ui/PremiumSelect';

const ROLE_OPTIONS = [
  { value: 'Team Member', label: 'Team Member', description: 'My Team', icon: Users },
  { value: 'Team Lead', label: 'Team Lead', description: 'My Team', icon: UsersRound },
  { value: 'Recruiter', label: 'Recruiter', description: 'My Team', icon: Briefcase },
  { value: 'HR Executive', label: 'HR Executive', description: 'My Team', icon: UserCog },
  { value: 'Reporting Manager', label: 'Reporting Manager', description: 'Reporting / Senior', icon: BarChart3 },
  { value: 'HR Manager', label: 'HR Manager', description: 'Reporting / Senior', icon: UserCog },
  { value: 'Director', label: 'Director', description: 'Reporting / Senior', icon: Target },
  { value: 'VP / Head', label: 'VP / Head', description: 'Reporting / Senior', icon: Shield },
  { value: 'Hiring Manager', label: 'Hiring Manager', description: 'Stakeholders', icon: Handshake },
  { value: 'SPOC', label: 'SPOC', description: 'Stakeholders', icon: Target },
  { value: 'Admin', label: 'Admin', description: 'Stakeholders', icon: Shield },
  { value: 'External', label: 'External', description: 'Stakeholders', icon: Users },
];

const BASE = API_URL;

const TeamPage = () => {
  const toast = useToast();
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
  const [formData, setFormData] = useState({ name: '', email: '', role: 'Team Member', phone: '', department: '', message: '' });

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

  const tabCategories = {
    myTeam: ['Team Member', 'Team Lead', 'Recruiter', 'HR Executive', 'HR'],
    reporting: ['Reporting Manager', 'HR Manager', 'Director', 'VP / Head', 'Manager'],
    stakeholders: ['Hiring Manager', 'SPOC', 'Admin', 'External'],
  };

  const filtered = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.department || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    return (tabCategories[activeTab] || []).includes(m.role || 'Team Member');
  });

  const getTabCount = (tab) => {
    if (tab === 'all') return members.length;
    return members.filter(m => (tabCategories[tab] || []).includes(m.role || 'Team Member')).length;
  };

  const roleColors = {
    'Team Lead': 'bg-teal-100 text-teal-700',
    'Manager': 'bg-brand-100 text-brand-700',
    'Team Member': 'bg-stone-100 text-stone-700',
    'HR': 'bg-green-100 text-green-700',
    'HR Executive': 'bg-green-100 text-green-700',
    'HR Manager': 'bg-emerald-100 text-emerald-700',
    'Recruiter': 'bg-amber-100 text-amber-700',
    'Admin': 'bg-red-100 text-red-700',
    'Reporting Manager': 'bg-sky-100 text-sky-700',
    'Director': 'bg-brand-100 text-brand-700',
    'VP / Head': 'bg-teal-100 text-teal-800',
    'Hiring Manager': 'bg-teal-100 text-teal-700',
    'SPOC': 'bg-orange-100 text-orange-700',
    'External': 'bg-stone-100 text-stone-600',
  };

  const filterTabs = [
    { key: 'all', label: 'All', icon: UsersRound },
    { key: 'myTeam', label: 'My Team', icon: Handshake },
    { key: 'reporting', label: 'Reporting', icon: BarChart3 },
    { key: 'stakeholders', label: 'Stakeholders', icon: Target },
  ];

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Users}
        title="Team Directory"
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
        <div className="toolbar-ats flex flex-col gap-3">
          <div className="relative flex-1 min-w-0 max-w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, role, department…"
              className="input-ats !pl-10"
              disabled={isLoading || members.length === 0}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
              <Filter size={14} /> Filter
            </div>
            {filterTabs.map((tab) => {
              const count = getTabCount(tab.key);
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
      )}

      <Modal
        open={showForm}
        onClose={resetForm}
        title={editingId ? 'Edit Team Member' : 'Add Team Member'}
        description="They’ll appear as CC/BCC suggestions when you send emails."
        size="lg"
        footer={
          <>
            <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="btn-primary">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Saving…' : editingId ? 'Update' : 'Add Member'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Full Name *</label>
              <div className="relative">
                <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
                  onBlur={() => setFormData((p) => ({ ...p, name: p.name.trim() }))}
                  className="input-ats !pl-10"
                  placeholder="John Doe"
                />
              </div>
            </div>
            <div>
              <label className="label-ats">Email Address *</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, email: e.target.value.trim().toLowerCase() }));
                    if (emailError) setEmailError('');
                  }}
                  onBlur={() => formData.email && checkEmailDomain(formData.email)}
                  className={`input-ats !pl-10 ${emailError ? 'input-ats-error' : ''}`}
                  placeholder={companyDomain?.domain ? `xyz@${companyDomain.domain}` : 'xyz@skillnixrecruitment.com'}
                />
              </div>
              {emailError && <p className="field-error">{emailError}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Role</label>
              <PremiumSelect
                value={formData.role}
                onChange={(v) => setFormData((p) => ({ ...p, role: v || 'Team Member' }))}
                options={ROLE_OPTIONS}
                placeholder="Select role"
                icon={Briefcase}
                searchable
                searchPlaceholder="Search roles…"
              />
            </div>
            <div>
              <label className="label-ats">Department</label>
              <div className="relative">
                <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
                  onBlur={() => setFormData((p) => ({ ...p, department: p.department.trim() }))}
                  className="input-ats !pl-10"
                  placeholder="e.g. Engineering"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="label-ats">Phone (Optional)</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                className="input-ats !pl-10"
                placeholder="+91-XXXXXXXXXX"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Content */}
      {isLoading ? (
        <div className="card-ats-bordered overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/80 flex items-center gap-3">
            <div className="h-4 w-32 skeleton-ats rounded-lg" />
          </div>
          <div className="divide-y divide-stone-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 sm:px-6 py-4">
                <div className="w-11 h-11 rounded-full skeleton-ats flex-shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-4 w-40 skeleton-ats rounded-lg" />
                  <div className="h-3 w-56 max-w-full skeleton-ats rounded-lg" />
                </div>
                <div className="hidden sm:block h-8 w-16 skeleton-ats rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="card-ats-bordered">
          <EmptyState
            icon={Users}
            tone="brand"
            message="No contacts yet"
            subMessage="Add your team members, reporting managers, and stakeholders here. They'll appear as suggestions when you CC/BCC in emails — just like Gmail."
            action={
              <button type="button" onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
                <Plus size={16} /> Add Your First Contact
              </button>
            }
          />
        </div>
      ) : (
        <div className="card-ats-bordered overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="px-5 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/80 flex items-center justify-between gap-3 mt-1">
            <p className="text-sm font-semibold text-stone-700">
              {filtered.length} team member{filtered.length !== 1 ? 's' : ''}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Clear search
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              tone="amber"
              message="No matching members"
              subMessage="Try adjusting your search or filter."
              action={
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setActiveTab('all'); }}
                  className="btn-secondary"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-stone-100 stagger-children">
              {filtered.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-4 hover:bg-brand-50/30 transition-colors duration-200 group"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 via-teal-600 to-teal-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-500/20 ring-2 ring-white">
                    <span className="text-white font-bold text-sm tracking-tight">
                      {member.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-stone-900 truncate tracking-tight">{member.name}</p>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg ${roleColors[member.role] || 'bg-stone-100 text-stone-600'}`}>
                        {member.role === 'SPOC' ? 'SPOC' : member.role}
                      </span>
                      {member.invitedMe && (
                        <span className="badge-success text-[10px]" title="This person invited you to their team">
                          Invited you
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      <p className="text-xs text-stone-500 flex items-center gap-1.5 min-w-0">
                        <Mail size={12} className="text-stone-400 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </p>
                      {member.phone && (
                        <p className="text-xs text-stone-400 flex items-center gap-1.5">
                          <Phone size={12} className="flex-shrink-0" /> {member.phone}
                        </p>
                      )}
                      {member.department && (
                        <p className="text-xs text-stone-400 flex items-center gap-1.5">
                          <Building2 size={12} className="flex-shrink-0" /> {member.department}
                        </p>
                      )}
                    </div>
                  </div>

                  {!member.invitedMe && (
                    <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(member)}
                        className="p-2.5 rounded-xl text-brand-600 hover:bg-brand-50 transition-colors touch-target"
                        title="Edit"
                        aria-label={`Edit ${member.name}`}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(member)}
                        disabled={deletingId === member._id}
                        className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors touch-target"
                        title="Remove"
                        aria-label={`Remove ${member.name}`}
                      >
                        {deletingId === member._id
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Trash2 size={15} />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
    </div>
  );
};

export default TeamPage;
