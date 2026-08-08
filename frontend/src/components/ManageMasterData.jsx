import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { formatByFieldName } from '../utils/textFormatter';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import { CATALOG } from './manageMasterData/masterDataConstants';
import SharingPanel from './manageMasterData/SharingPanel';
import PortalPanel from './manageMasterData/PortalPanel';
import MasterDataCatalog from './manageMasterData/MasterDataCatalog';
import MasterDataEditorModal from './manageMasterData/MasterDataEditorModal';

/**
 * Organization master lists — Positions, Clients, CV Sources.
 * One shared catalog per org (no personal vs team split).
 */
const ManageMasterData = ({ title, apiEndpoint }) => {
  const toast = useToast();
  const { organization } = useAuth();
  const cfg = CATALOG[title] || CATALOG.Positions;
  const Icon = cfg.icon;
  const isClients = apiEndpoint === '/api/clients';
  const hasClientSharing = isClients && planHasFeature(organization?.plan, 'agency.clientSharing');
  const hasClientPortal = isClients && planHasFeature(organization?.plan, 'agency.clientPortal');

  const [tourOpen, setTourOpen] = usePageTour(cfg.tourKey);
  const tourSteps = useMemo(() => [
    { title: cfg.headline, body: cfg.tip },
    { target: '[data-tour="list-toolbar"]', title: 'Find & sort', body: 'Search the catalog and change sort order.', placement: 'bottom' },
    { target: '[data-tour="list-table"]', title: 'Catalog', body: 'Edit or remove entries. They sync to Add Candidate dropdowns.', placement: 'top' },
  ], [cfg.headline, cfg.tip]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('name-asc');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [members, setMembers] = useState([]);
  const [sharingClient, setSharingClient] = useState(null);
  const [portalClient, setPortalClient] = useState(null);
  const [agencySaving, setAgencySaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}/all`);
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      if (!res.ok) { toast.error(`Could not load ${cfg.headline.toLowerCase()}`); return; }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error(`Could not load ${cfg.headline.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable enough; avoid reload loops
  }, [apiEndpoint, cfg.headline]);

  useEffect(() => { load(); }, [apiEndpoint]);

  useEffect(() => {
    if (!hasClientSharing) return undefined;
    let cancelled = false;
    authenticatedFetch(`${BASE_API_URL}/api/organization/members`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.success) setMembers(d.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [hasClientSharing]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (!q) return true;
      return `${r.name || ''} ${r.description || ''}`.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'name-asc' || sortKey === 'name-desc') {
        const cmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
        return sortKey === 'name-asc' ? cmp : -cmp;
      }
      const ta = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return sortKey === 'newest' ? tb - ta : ta - tb;
    });
    return list;
  }, [rows, query, sortKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setEditorOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name || '', description: item.description || '' });
    setEditorOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      name: formatByFieldName('name', form.name),
      description: formatByFieldName('description', form.description),
    };
    if (!payload.name.trim()) {
      toast.warning('Name is required');
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `${BASE_API_URL}${apiEndpoint}/${editing._id}`
        : `${BASE_API_URL}${apiEndpoint}`;
      const res = await authenticatedFetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Could not save');
        return;
      }
      toast.success(editing ? 'Updated' : 'Added to organization list');
      setEditorOpen(false);
      setEditing(null);
      setForm({ name: '', description: '' });
      await load();
    } catch {
      toast.error('Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}/${deleteTarget._id}`, { method: 'DELETE' });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      if (!res.ok) { toast.error('Could not delete'); return; }
      toast.success('Removed');
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error('Could not delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleSeed = async () => {
    if (!cfg.seedable) return;
    setSeeding(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.message || 'Could not load starter set'); return; }
      toast.success(`Starter set ready (${data.added ?? 0} added)`);
      await load();
    } catch {
      toast.error('Could not load starter set');
    } finally {
      setSeeding(false);
    }
  };

  const saveSharing = async (userIds) => {
    setAgencySaving(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/clients/${sharingClient._id}/sharing`, {
        method: 'PUT',
        body: JSON.stringify({ userIds }),
      });
      const updated = await res.json();
      if (!res.ok) { toast.error(updated.message || 'Failed to update sharing'); return; }
      toast.success('Sharing updated');
      setSharingClient(null);
      await load();
    } catch {
      toast.error('Failed to update sharing');
    } finally {
      setAgencySaving(false);
    }
  };

  const enablePortal = async () => {
    setAgencySaving(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/clients/${portalClient._id}/portal/enable`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const updated = await res.json();
      if (!res.ok) { toast.error(updated.message || 'Failed to enable portal'); return; }
      setPortalClient(updated);
      await load();
    } catch {
      toast.error('Failed to enable portal');
    } finally {
      setAgencySaving(false);
    }
  };

  const disablePortal = async () => {
    setAgencySaving(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/clients/${portalClient._id}/portal/disable`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const updated = await res.json();
      if (!res.ok) { toast.error(updated.message || 'Failed to disable portal'); return; }
      setPortalClient(updated);
      await load();
    } catch {
      toast.error('Failed to disable portal');
    } finally {
      setAgencySaving(false);
    }
  };

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader icon={Icon} title={cfg.headline} subtitle={cfg.subtitle} gradientTitle>
        {cfg.seedable && (
          <button type="button" onClick={handleSeed} disabled={seeding} className="btn-secondary flex-1 sm:flex-none disabled:opacity-50">
            {seeding ? <Loader2 size={16} className="animate-spin" /> : null}
            {seeding ? 'Loading…' : 'Load starter set'}
          </button>
        )}
        <button type="button" onClick={openCreate} className="btn-primary flex-1 sm:flex-none" data-tour="list-add">
          <Plus size={16} /> Add {cfg.singular}
        </button>
      </PageHeader>

      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
        {cfg.tip} Press <span className="font-semibold text-stone-800">?</span> for a short tour.
      </div>

      <MasterDataCatalog
        cfg={cfg}
        Icon={Icon}
        query={query}
        setQuery={setQuery}
        sortKey={sortKey}
        setSortKey={setSortKey}
        loading={loading}
        visible={visible}
        hasClientSharing={hasClientSharing}
        hasClientPortal={hasClientPortal}
        seeding={seeding}
        onSeed={handleSeed}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onShare={setSharingClient}
        onPortal={setPortalClient}
      />

      <MasterDataEditorModal
        open={editorOpen}
        saving={saving}
        editing={editing}
        form={form}
        setForm={setForm}
        cfg={cfg}
        title={title}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleSave}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Remove ${cfg.singular}?`}
        message={`Remove "${deleteTarget?.name}" from the organization list? It will no longer appear in Add Candidate.`}
        confirmText="Remove"
        type="delete"
        isLoading={deleting}
      />

      {sharingClient && (
        <SharingPanel
          client={sharingClient}
          members={members}
          saving={agencySaving}
          onClose={() => setSharingClient(null)}
          onSave={saveSharing}
        />
      )}
      {portalClient && (
        <PortalPanel
          client={portalClient}
          saving={agencySaving}
          onClose={() => setPortalClient(null)}
          onEnable={enablePortal}
          onDisable={disablePortal}
        />
      )}

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title={`Tour of ${cfg.headline}`} />
      <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={tourSteps} storageKey={cfg.tourKey} />
    </div>
  );
};

export default ManageMasterData;
