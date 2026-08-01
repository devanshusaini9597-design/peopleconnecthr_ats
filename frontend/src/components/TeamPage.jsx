import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Mail, Phone, Briefcase, X, Save, Loader2, Search, Building2, ChevronDown, CheckCircle, Clock, UsersRound, Handshake, BarChart3, Target } from 'lucide-react';
import API_URL from '../config';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';

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

  return (
    <>
      <div className="page-shell-ats max-w-5xl">
        <PageHeader
          icon={Users}
          title="Team Directory"
          subtitle="Add colleagues, managers & stakeholders — quickly CC/BCC them in emails."
          gradientTitle
        >
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary"
          >
            <Plus size={16} /> Add Member
          </button>
        </PageHeader>

        {/* Tabs */}
        {members.length > 0 && (
          <div className="flex gap-1 p-1 bg-stone-100 rounded-2xl mb-4 overflow-x-auto scrollbar-hide">
            {[
              { key: 'all', label: 'All', icon: UsersRound },
              { key: 'myTeam', label: 'My Team', icon: Handshake },
              { key: 'reporting', label: 'Reporting / Senior', icon: BarChart3 },
              { key: 'stakeholders', label: 'Stakeholders', icon: Target },
            ].map(tab => {
              const count = getTabCount(tab.key);
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-white shadow-sm text-stone-900'
                      : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <Icon size={15} className={activeTab === tab.key ? 'text-brand-600' : ''} />
                  {tab.label}
                  {count > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-brand-100 text-brand-700' : 'bg-stone-200 text-stone-500'}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Search */}
        {members.length > 0 && (
          <div className="relative mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, role, or department..."
              className="input-ats pl-10"
            />
          </div>
        )}

        {/* PENDING INVITATIONS BANNER */}
        {pendingInvitations.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={18} className="text-amber-600" />
              <h3 className="text-sm font-bold text-amber-800">Pending Invitations ({pendingInvitations.length})</h3>
            </div>
            <div className="space-y-3">
              {pendingInvitations.map(inv => (
                <div key={inv._id} className="flex items-center justify-between bg-white rounded-lg border border-amber-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                      <Mail size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-900">Team invitation from <span className="text-brand-600">{inv.invitedBy ? 'a team member' : 'Unknown'}</span></p>
                      <p className="text-xs text-stone-500">Role: {inv.role || 'Team Member'}{inv.department ? ` in ${inv.department}` : ''}</p>
                      {inv.invitationMessage && <p className="text-xs text-stone-400 italic mt-0.5">"{inv.invitationMessage}"</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAcceptInvitation(inv._id)}
                      disabled={processingInvitation === inv._id}
                      className="btn-primary !text-xs !px-4 !py-2 !from-emerald-600 !via-emerald-600 !to-emerald-700"
                    >
                      {processingInvitation === inv._id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineInvitation(inv._id)}
                      disabled={processingInvitation === inv._id}
                      className="btn-secondary !text-xs !px-4 !py-2"
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-ats">Full Name *</label>
                <div className="relative">
                  <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
                    onBlur={() => setFormData((p) => ({ ...p, name: p.name.trim() }))}
                    className="input-ats !pl-9"
                    placeholder="John Doe"
                  />
                </div>
              </div>
              <div>
                <label className="label-ats">Email Address *</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, email: e.target.value.trim().toLowerCase() }));
                      if (emailError) setEmailError('');
                    }}
                    onBlur={() => formData.email && checkEmailDomain(formData.email)}
                    className={`input-ats !pl-9 ${emailError ? 'input-ats-error' : ''}`}
                    placeholder={companyDomain?.domain ? `xyz@${companyDomain.domain}` : 'xyz@skillnixrecruitment.com'}
                  />
                </div>
                {emailError && <p className="field-error">{emailError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-ats">Role</label>
                <div className="relative">
                  <Briefcase size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                    className="input-ats !pl-9 !pr-9 appearance-none cursor-pointer"
                  >
                    <optgroup label="My Team">
                      <option value="Team Member">Team Member</option>
                      <option value="Team Lead">Team Lead</option>
                      <option value="Recruiter">Recruiter</option>
                      <option value="HR Executive">HR Executive</option>
                    </optgroup>
                    <optgroup label="Reporting / Senior">
                      <option value="Reporting Manager">Reporting Manager</option>
                      <option value="HR Manager">HR Manager</option>
                      <option value="Director">Director</option>
                      <option value="VP / Head">VP / Head</option>
                    </optgroup>
                    <optgroup label="Stakeholders">
                      <option value="Hiring Manager">Hiring Manager</option>
                      <option value="SPOC">SPOC</option>
                      <option value="Admin">Admin</option>
                      <option value="External">External</option>
                    </optgroup>
                  </select>
                </div>
              </div>
              <div>
                <label className="label-ats">Department</label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
                    onBlur={() => setFormData((p) => ({ ...p, department: p.department.trim() }))}
                    className="input-ats !pl-9"
                    placeholder="e.g. Engineering"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="label-ats">Phone (Optional)</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  className="input-ats !pl-9"
                  placeholder="+91-XXXXXXXXXX"
                />
              </div>
            </div>
          </div>
        </Modal>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={32} className="text-brand-600 animate-spin" />
            <p className="text-stone-500 mt-3">Loading team...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="card-ats-bordered">
            <EmptyState
              icon={Users}
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
          <div className="card-ats-bordered overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-600">{filtered.length} team member{filtered.length !== 1 ? 's' : ''}</p>
            </div>
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-sm">No team members match your search</div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filtered.map(member => (
                  <div key={member._id} className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50/50 transition-colors group">
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-stone-900 truncate">{member.name}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${roleColors[member.role] || 'bg-stone-100 text-stone-600'}`}>
                          {member.role === 'SPOC' ? 'SPOC' : member.role}
                        </span>
                        {member.invitedMe && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700" title="This person invited you to their team">Invited you</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-stone-500 flex items-center gap-1"><Mail size={11} /> {member.email}</p>
                        {member.phone && <p className="text-xs text-stone-400 flex items-center gap-1"><Phone size={11} /> {member.phone}</p>}
                        {member.department && <p className="text-xs text-stone-400 flex items-center gap-1"><Building2 size={11} /> {member.department}</p>}
                      </div>
                    </div>

                    {/* Actions - only for members I invited (not "invited me") */}
                    {!member.invitedMe && (
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(member)} className="p-2 hover:bg-brand-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 size={15} className="text-brand-600" />
                        </button>
                        <button onClick={() => confirmDelete(member)} disabled={deletingId === member._id}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                          {deletingId === member._id ? <Loader2 size={15} className="text-red-400 animate-spin" /> : <Trash2 size={15} className="text-red-500" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Remove Team Member"
          message={`Are you sure you want to remove "${deleteConfirm?.name}" from your team? This action cannot be undone.`}
          details={deleteConfirm && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">{deleteConfirm.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
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
    </>
  );
};

export default TeamPage;
