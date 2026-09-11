import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldPlus, Plus, Lock, Info, Shield, RotateCcw, Edit2, LayoutGrid, Zap,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { PERMISSION_CATALOG as FALLBACK_CATALOG, countModules, countActions } from '../config/permissionsCatalog';
import {
  ROLES_TOUR_KEY,
  ROLES_TOUR_STEPS,
} from './customRoles/customRolesConstants';
import RoleModal from './customRoles/RoleModal';
import { RolesSearchBar, RolesGrid } from './customRoles/RolesGrid';

const CustomRolesPage = () => {
  const toast = useToast();
  const { user } = useAuth();
  const [tourOpen, setTourOpen] = usePageTour(ROLES_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [roles, setRoles] = useState([]);
  const [systemRoles, setSystemRoles] = useState([]);
  const [catalog, setCatalog] = useState(FALLBACK_CATALOG);
  const [query, setQuery] = useState('');
  const [modalRole, setModalRole] = useState(null);
  const [systemMode, setSystemMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permRes, systemRes] = await Promise.all([
        authenticatedFetch('/api/custom-roles'),
        authenticatedFetch('/api/custom-roles/permissions'),
        authenticatedFetch('/api/custom-roles/system-roles'),
      ]);
      if (rolesRes.status === 401) return handleUnauthorized();
      const data = await rolesRes.json();
      if (rolesRes.status === 403 && data.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (data.success) setRoles(data.data || []);

      if (systemRes.ok) {
        const sysData = await systemRes.json();
        if (sysData.success) setSystemRoles(sysData.data || []);
      }

      if (permRes.ok) {
        const permData = await permRes.json();
        if (permData.catalog?.length) {
          setCatalog(permData.catalog);
        } else if (Array.isArray(permData.data) && permData.data.length) {
          const allowed = new Set(permData.data);
          setCatalog(
            FALLBACK_CATALOG
              .map((g) => ({ ...g, items: g.items.filter((i) => allowed.has(i.key)) }))
              .filter((g) => g.items.length > 0)
          );
        }
      }
    } catch (err) {
      toast?.error?.('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setSystemMode(false);
    setModalRole(null);
    setShowModal(true);
  };
  const openEdit = (role) => {
    setSystemMode(false);
    setModalRole(role);
    setShowModal(true);
  };
  const openEditSystem = (role) => {
    if (!role?.canEdit) {
      toast?.error?.(
        role?.key === 'admin' || role?.key === 'hr_manager'
          ? 'Only Owner or Admin can edit this role'
          : 'You cannot edit this system role'
      );
      return;
    }
    setSystemMode(true);
    setModalRole({
      key: role.key,
      name: role.label,
      label: role.label,
      description: role.description,
      permissions: role.permissions || [],
    });
    setShowModal(true);
  };

  const filteredRoles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q)
        || (r.description || '').toLowerCase().includes(q)
    );
  }, [roles, query]);

  const handleSave = async (form) => {
    if (systemMode && form.systemKey) {
      const target = systemRoles.find((r) => r.key === form.systemKey);
      if (target && !target.canEdit) {
        toast?.error?.('You cannot edit this system role');
        return;
      }
    }
    setSaving(true);
    try {
      if (systemMode && form.systemKey) {
        const res = await authenticatedFetch(`/api/custom-roles/system-roles/${form.systemKey}`, {
          method: 'PUT',
          body: JSON.stringify({ permissions: form.permissions || [] }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast?.error?.(data.message || 'Failed to save system role');
          return;
        }
        toast?.success?.(`${form.name} permissions updated — applies to all users with this role`);
        setShowModal(false);
        load();
        return;
      }

      const isEdit = !!modalRole?._id;
      const res = await authenticatedFetch(isEdit ? `/api/custom-roles/${modalRole._id}` : '/api/custom-roles', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          permissions: form.permissions,
        }),
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

  const handleResetSystem = async () => {
    if (!resetTarget?.key) return;
    if (!resetTarget.canEdit) {
      toast?.error?.('You cannot reset this system role');
      return;
    }
    setResetting(true);
    try {
      const res = await authenticatedFetch(`/api/custom-roles/system-roles/${resetTarget.key}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to reset role');
        return;
      }
      toast?.success?.(`${resetTarget.label} reset to product defaults`);
      setResetTarget(null);
      load();
    } catch (err) {
      toast?.error?.('Failed to reset role');
    } finally {
      setResetting(false);
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
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Roles & permissions is an Enterprise feature</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Upgrade to Enterprise to edit system role access and build custom permission packs.
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
        title="Roles & permissions"
        subtitle="Edit system roles once for everyone — or create custom packs for special cases."
        gradientTitle
      >
        <button type="button" onClick={openCreate} className="btn-primary flex-1 sm:flex-none">
          <Plus className="w-4 h-4" /> New custom pack
        </button>
      </PageHeader>

      <div
        data-tour="roles-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Enterprise tip
        </span>
        <span>
          Prefer editing <span className="font-semibold text-stone-800">system roles</span> for everyone on that role.
          Use a <span className="font-semibold text-stone-800">custom pack</span> only for one-off exceptions.
          Hierarchy: Owner/Admin edit Admin, HR Manager, Recruiter, Sales, Freelance Recruiter, and Other. HR Manager may edit Recruiter, Sales, Freelance Recruiter, and Other.
        </span>
      </div>

      {/* System roles — edit rights depend on caller hierarchy */}
      <section className="space-y-3">
        <div>
          <h3 className="section-title-ats !mb-1">
            <Shield className="w-4 h-4 text-brand-600" />
            System roles
          </h3>
          <p className="text-sm text-stone-500">
            Edit once — applies to all teammates with that role (unless they have a custom pack assigned).
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {systemRoles.map((role) => {
            const mods = countModules(role.permissions);
            const acts = countActions(role.permissions);
            return (
              <article
                key={role.key}
                className="card-ats-bordered p-5 relative overflow-hidden group flex flex-col"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shadow-md flex-shrink-0 ${
                    role.key === 'freelancer'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-900'
                      : 'bg-gradient-to-br from-stone-700 to-stone-900'
                  }`}>
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-stone-900 tracking-tight truncate">{role.label}</h3>
                      {role.isCustomized ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                          Customized
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-500 mt-0.5 line-clamp-2">{role.description}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-stone-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-brand-50 text-brand-700 border-brand-100">
                      <LayoutGrid size={10} /> {mods} module{mods !== 1 ? 's' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-teal-50 text-teal-700 border-teal-100">
                      <Zap size={10} /> {acts} action{acts !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {role.canEdit ? (
                      <>
                        {role.isCustomized && (
                          <button
                            type="button"
                            onClick={() => setResetTarget(role)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:text-amber-700 hover:border-amber-200"
                            title="Reset to defaults"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditSystem(role)}
                          className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 text-brand-800 text-[11px] font-bold hover:bg-brand-100"
                        >
                          <Edit2 size={13} />
                          Edit
                        </button>
                      </>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-500 text-[11px] font-bold"
                        title={
                          role.key === 'admin' || role.key === 'hr_manager'
                            ? 'Only Owner or Admin can edit this role'
                            : 'You cannot edit this role'
                        }
                      >
                        <Lock size={12} />
                        View only
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Custom packs */}
      <section className="space-y-3 pt-2">
        <div>
          <h3 className="section-title-ats !mb-1">
            <ShieldPlus className="w-4 h-4 text-brand-600" />
            Custom packs
          </h3>
          <p className="text-sm text-stone-500">
            Optional one-off packs for a single person or special team — assign from Organization → Team.
          </p>
        </div>

        {roles.length > 0 && (
          <RolesSearchBar query={query} setQuery={setQuery} />
        )}

        <RolesGrid
          roles={roles}
          filteredRoles={filteredRoles}
          openCreate={openCreate}
          openEdit={openEdit}
          setDeleteTarget={setDeleteTarget}
        />
      </section>

      <RoleModal
        open={showModal}
        initial={modalRole}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        saving={saving}
        catalog={catalog}
        systemMode={systemMode}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete custom pack?"
        message={`Delete the "${deleteTarget?.name}" pack? Users assigned to it will revert to their system role permissions.`}
        confirmText="Delete pack"
        type="delete"
        isLoading={deleting}
      />
      <ConfirmationModal
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={handleResetSystem}
        title={`Reset ${resetTarget?.label}?`}
        message={`Restore product defaults for ${resetTarget?.label}. Everyone with this system role will get the default permissions again.`}
        confirmText="Reset to defaults"
        type="warning"
        isLoading={resetting}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Roles" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={ROLES_TOUR_STEPS}
        storageKey={ROLES_TOUR_KEY}
      />
    </div>
  );
};

export default CustomRolesPage;
