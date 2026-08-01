import React, { useState, useEffect, useCallback } from 'react';
import { ShieldPlus, Plus, Trash2, Edit2, X, Lock, Loader2 } from 'lucide-react';
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

const RoleModal = ({ initial, onClose, onSave, saving }) => {
  const [form, setForm] = useState(initial || emptyForm);

  const togglePermission = (perm) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{initial ? 'Edit Role' : 'New Custom Role'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-sm font-medium text-gray-700">Role name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Senior Recruiter"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Permissions</label>
            <div className="space-y-4">
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                <div key={group}>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{group}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {perms.map((perm) => (
                      <label key={perm} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(perm)}
                          onChange={() => togglePermission(perm)}
                          className="rounded border-gray-300"
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
        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
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

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete the "${role.name}" role? Users assigned to it will revert to their base role.`)) return;
    try {
      const res = await authenticatedFetch(`/api/custom-roles/${role._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to delete role');
        return;
      }
      toast?.success?.('Role deleted');
      load();
    } catch (err) {
      toast?.error?.('Failed to delete role');
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /></div>;
  }

  if (upgradeRequired) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Custom Roles is an Enterprise feature</h2>
          <p className="text-gray-500 mt-2 text-sm">Upgrade to Enterprise to build fine-grained permission sets beyond the standard 5 roles.</p>
          <a href="/billing" className="inline-block mt-6 px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">View Plans</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <ShieldPlus className="w-6 h-6 text-gray-400" /> Custom Roles
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Define fine-grained permission sets and assign them to team members.</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Role
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {roles.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <ShieldPlus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p>No custom roles yet.</p>
              <p className="text-xs text-gray-400 mt-1">Create one to give team members a permission set beyond the standard roles.</p>
            </div>
          ) : roles.map((role) => (
            <div key={role._id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{role.name}</div>
                {role.description && <div className="text-sm text-gray-500">{role.description}</div>}
                <div className="text-xs text-gray-400 mt-1">{role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(role)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(role)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Role assignment: use <code>PUT /api/custom-roles/assign/:userId</code> (Team UI integration is pending —
          see the User/TeamMember model note in the productization blueprint).
        </p>
      </div>

      {showModal && (
        <RoleModal
          initial={modalRole}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
};

export default CustomRolesPage;
