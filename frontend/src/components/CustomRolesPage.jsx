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

  const toggleGroup = (perms) => {
    setForm((f) => {
      const allOn = perms.every((p) => f.permissions.includes(p));
      if (allOn) {
        return { ...f, permissions: f.permissions.filter((p) => !perms.includes(p)) };
      }
      return { ...f, permissions: [...new Set([...f.permissions, ...perms])] };
    });
  };

  const selectedCount = form.permissions.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Role' : 'New Custom Role'}
      description="Name the role and pick the permissions it grants."
      size="lg"
      footer={
        <>
          <span className="hidden sm:inline text-xs font-medium text-stone-400 mr-auto self-center">
            {selectedCount} permission{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
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
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label-ats">Role name *</label>
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
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="label-ats !mb-0">Permissions</label>
            <span className="text-[11px] font-semibold text-stone-400 sm:hidden">
              {selectedCount} selected
            </span>
          </div>
          <div className="rounded-xl border border-stone-200 overflow-hidden divide-y divide-stone-100">
            {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
              const allOn = perms.every((p) => form.permissions.includes(p));
              const someOn = !allOn && perms.some((p) => form.permissions.includes(p));
              return (
                <div key={group} className="bg-white">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-stone-50/90 border-b border-stone-100/80">
                    <button
                      type="button"
                      onClick={() => toggleGroup(perms)}
                      className="flex items-center gap-2 text-left min-w-0"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                          allOn
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : someOn
                              ? 'bg-brand-100 border-brand-400 text-brand-700'
                              : 'bg-white border-stone-300 text-transparent'
                        }`}
                        aria-hidden
                      >
                        {allOn ? '✓' : someOn ? '–' : ''}
                      </span>
                      <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">{group}</span>
                    </button>
                    <span className="text-[10px] font-semibold text-stone-400 tabular-nums">
                      {perms.filter((p) => form.permissions.includes(p)).length}/{perms.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
                    {perms.map((perm) => {
                      const checked = form.permissions.includes(perm);
                      return (
                        <label
                          key={perm}
                          className={`flex items-center gap-2 text-sm cursor-pointer px-3 py-2 border-stone-50 transition-colors ${
                            checked
                              ? 'bg-brand-50/70 text-brand-800'
                              : 'text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(perm)}
                            className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30 w-3.5 h-3.5"
                          />
                          <span className="font-medium capitalize text-[13px] truncate">{perm.split('.')[1]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
      <div className="page-shell-ats animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-48 skeleton-ats rounded-lg" />
            <div className="h-4 w-72 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="card-ats-bordered overflow-hidden mt-2 divide-y divide-stone-100">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl skeleton-ats" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 skeleton-ats rounded-lg" />
                <div className="h-3 w-56 skeleton-ats rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
              <Lock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Custom Roles is an Enterprise feature</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Upgrade to Enterprise to build fine-grained permission sets beyond the standard roles.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={ShieldPlus}
        title="Custom Roles"
        subtitle="Define fine-grained permission sets and assign them to team members."
        gradientTitle
      >
        <button type="button" onClick={openCreate} className="btn-primary flex-1 sm:flex-none">
          <Plus className="w-4 h-4" /> New Role
        </button>
      </PageHeader>

      {roles.length === 0 ? (
        <div className="card-ats-bordered">
          <EmptyState
            icon={ShieldPlus}
            tone="violet"
            message="No custom roles yet"
            subMessage="Create one to give team members a permission set beyond the standard roles."
            action={
              <button type="button" onClick={openCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> New Role
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 stagger-children">
          {roles.map((role) => (
            <article
              key={role._id}
              className="card-ats-bordered p-5 relative overflow-hidden group flex flex-col"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center shadow-md shadow-brand-500/20 flex-shrink-0">
                  <ShieldPlus className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-stone-900 tracking-tight truncate">{role.name}</h3>
                  {role.description ? (
                    <p className="text-sm text-stone-500 mt-0.5 line-clamp-2">{role.description}</p>
                  ) : (
                    <p className="text-sm text-stone-400 mt-0.5 italic">No description</p>
                  )}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-stone-100">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-brand-50 text-brand-700 border-brand-100">
                  {role.permissions?.length || 0} permission{(role.permissions?.length || 0) !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => openEdit(role)}
                    className="p-2.5 rounded-xl text-brand-600 hover:bg-brand-50 transition-colors touch-target"
                    title="Edit role"
                    aria-label={`Edit ${role.name}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(role)}
                    className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors touch-target"
                    title="Delete role"
                    aria-label={`Delete ${role.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

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
