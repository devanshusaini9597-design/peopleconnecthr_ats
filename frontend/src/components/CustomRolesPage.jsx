import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldPlus, Plus, Lock, Info,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { PERMISSION_CATALOG as FALLBACK_CATALOG } from '../config/permissionsCatalog';
import {
  ROLES_TOUR_KEY,
  ROLES_TOUR_STEPS,
} from './customRoles/customRolesConstants';
import RoleModal from './customRoles/RoleModal';
import { RolesSearchBar, RolesGrid } from './customRoles/RolesGrid';

const CustomRolesPage = () => {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(ROLES_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState(FALLBACK_CATALOG);
  const [query, setQuery] = useState('');
  const [modalRole, setModalRole] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permRes] = await Promise.all([
        authenticatedFetch('/api/custom-roles'),
        authenticatedFetch('/api/custom-roles/permissions'),
      ]);
      if (rolesRes.status === 401) return handleUnauthorized();
      const data = await rolesRes.json();
      if (rolesRes.status === 403 && data.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (data.success) setRoles(data.data || []);

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
      toast?.error?.('Failed to load custom roles');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setModalRole(null); setShowModal(true); };
  const openEdit = (role) => { setModalRole(role); setShowModal(true); };

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
    setSaving(true);
    try {
      const isEdit = !!modalRole;
      const res = await authenticatedFetch(isEdit ? `/api/custom-roles/${modalRole._id}` : '/api/custom-roles', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(form),
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
        subtitle="Define which sidebar modules and actions each role can use — then assign from Team."
        gradientTitle
      >
        <button type="button" onClick={openCreate} className="btn-primary flex-1 sm:flex-none">
          <Plus className="w-4 h-4" /> New Role
        </button>
      </PageHeader>

      <div
        data-tour="roles-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          Pick <span className="font-semibold text-stone-800">modules</span> (sidebar pages) and{' '}
          <span className="font-semibold text-stone-800">actions</span> (create/edit/delete). Assign the pack on Organization → Team.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
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

      <RoleModal
        open={showModal}
        initial={modalRole}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        saving={saving}
        catalog={catalog}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete custom role?"
        message={`Delete the "${deleteTarget?.name}" role? Users assigned to it will revert to their base system role permissions.`}
        confirmText="Delete Role"
        type="delete"
        isLoading={deleting}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Custom Roles" />
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
