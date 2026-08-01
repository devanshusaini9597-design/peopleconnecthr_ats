import React, { useState, useEffect, useCallback } from 'react';
import { ShieldPlus, Plus, Trash2, Edit2, Lock, Loader2 } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const PERMISSION_GROUPS = {
  Jobs: ['jobs.create', 'jobs.edit', 'jobs.delete', 'jobs.publish'],
  Candidates: ['candidates.create', 'candidates.edit', 'candidates.delete', 'candidates.export'],
  Applications: ['applications.edit', 'applications.reject'],
  Interviews: ['interviews.schedule', 'interviews.cancel', 'scorecards.submit'],
  Team: ['team.invite', 'team.remove', 'team.changeRole'],
  Organization: ['organization.editSettings', 'organization.manageIntegrations'],
  Audit: ['audit.view', 'audit.export'],
  Billing: ['billing.manage']
};

const emptyForm = { name: '', description: '', permissions: [] };

const RoleModal = ({ open, initial, onClose, onSave, saving }) => {
  const [form, setForm] = useState(initial || emptyForm);

  useEffect(() => {
    if (open) setForm(initial || emptyForm);
  }, [open, initial]);

  const togglePermission = (perm) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm]
    }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Role' : 'New Custom Role'}
      description="Choose a name and the permissions this role grants."
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Role'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-ats">Role name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input-ats"
            placeholder="e.g. Senior Recruiter"
            autoFocus
          />
        </div>
        <div>
          <label className="label-ats">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="input-ats"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="label-ats mb-2">Permissions</label>
          <div className="space-y-4">
            {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
              <div key={group}>
                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">{group}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {perms.map((perm) => (
                    <label key={perm} className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer min-h-[44px] sm:min-h-0 py-1">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                        className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30"
                      />
                      {perm.split('.')[1]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const CustomRolesPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [roles, setRoles] = useState([]);
  const [modalRole, setModalRole] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/custom-roles');
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (res.status === 403 && data.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (data.success) setRoles(data.data || []);
    } catch (err) {
      toast?.error?.('Failed to load custom roles');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setModalRole(null); setShowModal(true); };
  const openEdit = (role) => { setModalRole(role); setShowModal(true); };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const isEdit = !!modalRole;
      const res = await authenticatedFetch(isEdit ? `/api/custom-roles/${modalRole._id}` : '/api/custom-roles', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to save role');
        return;
      }
      toast?.success?.(isEdit ? 'Role updated' : 'Role created');
      setShowModal(false);
      load();
    } catch (err) {
      toast?.error?.('Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/custom-roles/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to delete role');
        return;
      }
      toast?.success?.('Role deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast?.error?.('Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading custom roles…</p>
        </div>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
              <Lock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Custom Roles is an Enterprise feature</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Upgrade to Enterprise to build fine-grained permission sets beyond the standard 5 roles.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats max-w-4xl">
      <PageHeader
        icon={ShieldPlus}
        title="Custom Roles"
        subtitle="Define fine-grained permission sets and assign them to team members."
        gradientTitle
      >
        <button type="button" onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> New Role
        </button>
      </PageHeader>

      <div className="card-ats-bordered divide-y divide-stone-100 overflow-hidden">
        {roles.length === 0 ? (
          <EmptyState
            icon={ShieldPlus}
            message="No custom roles yet."
            subMessage="Create one to give team members a permission set beyond the standard roles."
            action={
              <button type="button" onClick={openCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> New Role
              </button>
            }
          />
        ) : roles.map((role) => (
          <div key={role._id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
            <div className="min-w-0">
              <div className="font-semibold text-stone-900">{role.name}</div>
              {role.description && <div className="text-sm text-stone-500 mt-0.5">{role.description}</div>}
              <span className="badge-neutral mt-2 inline-flex">
                {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEdit(role)}
                className="p-2.5 hover:bg-stone-100 rounded-xl text-stone-500 hover:text-brand-600 transition-colors touch-target"
                title="Edit role"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(role)}
                className="p-2.5 hover:bg-red-50 rounded-xl text-stone-400 hover:text-red-500 transition-colors touch-target"
                title="Delete role"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-400 leading-relaxed">
        Role assignment: use <code className="text-stone-500">PUT /api/custom-roles/assign/:userId</code> (Team UI integration is pending —
        see the User/TeamMember model note in the productization blueprint).
      </p>

      <RoleModal
        open={showModal}
        initial={modalRole}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        saving={saving}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete custom role?"
        message={`Delete the "${deleteTarget?.name}" role? Users assigned to it will revert to their base role.`}
        confirmText="Delete Role"
        type="delete"
        isLoading={deleting}
      />
    </div>
  );
};

export default CustomRolesPage;
