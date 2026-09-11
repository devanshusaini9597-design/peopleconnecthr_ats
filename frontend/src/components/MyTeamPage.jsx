import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, Tags, UserPlus, Plus, Loader2, Trash2, AtSign, Shield, X,
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import PresenceAvatar from './ui/PresenceAvatar';
import { formatRoleLabel } from './organization/constants';
import { TAG_COLORS, tagChipClass, handlePreview } from './myTeam/myTeamConstants';

const EMPTY_TAG = { name: '', color: 'brand', memberIds: [] };

export default function MyTeamPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({
    manager: null, reports: [], tags: [], colleagues: [], canReassign: false,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const [tagModal, setTagModal] = useState(null);
  const [tagForm, setTagForm] = useState(EMPTY_TAG);
  const [savingTag, setSavingTag] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [deleteTag, setDeleteTag] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/my-team');
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Could not load My Team');
      setOverview(data.data || {});
    } catch (err) {
      toast.error(err.message || 'Could not load My Team');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const colleagueOptions = useMemo(
    () => (overview.colleagues || []).map((c) => ({
      value: c.id,
      label: c.name || c.email,
      description: c.email,
    })),
    [overview.colleagues]
  );

  const addReport = async () => {
    if (!addUserId) return;
    setAdding(true);
    try {
      const res = await authenticatedFetch('/api/my-team/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: addUserId }),
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Added to your team');
      setAddOpen(false);
      setAddUserId('');
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not add teammate');
    } finally {
      setAdding(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      const res = await authenticatedFetch(`/api/my-team/reports/${removeTarget.id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Removed from your team');
      setRemoveTarget(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not remove');
    } finally {
      setBusy(false);
    }
  };

  const openCreateTag = () => {
    setTagForm(EMPTY_TAG);
    setTagModal({ mode: 'create' });
  };

  const openEditTag = (tag) => {
    setTagForm({
      name: tag.name,
      color: tag.color || 'brand',
      memberIds: tag.memberIds || [],
    });
    setTagModal({ mode: 'edit', id: tag.id });
  };

  const saveTag = async () => {
    const name = tagForm.name.trim();
    if (name.length < 2) {
      toast.error('Give the tag a name');
      return;
    }
    setSavingTag(true);
    try {
      const isEdit = tagModal?.mode === 'edit';
      const res = await authenticatedFetch(isEdit ? `/api/my-team/tags/${tagModal.id}` : '/api/my-team/tags', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tagForm),
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success(isEdit ? 'Tag updated' : `Tag @${data.data?.handle || handlePreview(name)} created`);
      setTagModal(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not save tag');
    } finally {
      setSavingTag(false);
    }
  };

  const confirmDeleteTag = async () => {
    if (!deleteTag) return;
    setBusy(true);
    try {
      const res = await authenticatedFetch(`/api/my-team/tags/${deleteTag.id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Tag deleted');
      setDeleteTag(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not delete tag');
    } finally {
      setBusy(false);
    }
  };

  const handle = handlePreview(tagForm.name);

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Users}
        title="My Team"
        subtitle="Your reporting line, the people who work with you, and tags you can @mention — like pods in Greenhouse or Slack user groups."
        gradientTitle
      >
        <button type="button" className="btn-secondary" onClick={() => setAddOpen(true)}>
          <UserPlus className="w-4 h-4" /> Add teammate
        </button>
        <button type="button" className="btn-primary" onClick={openCreateTag}>
          <Plus className="w-4 h-4" /> New tag
        </button>
      </PageHeader>

      {overview.manager && (
        <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="p-4 sm:p-5 flex items-center gap-3">
            <PresenceAvatar name={overview.manager.name} email={overview.manager.email} size={40} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">You report to</p>
              <p className="text-sm font-bold text-stone-900 truncate">{overview.manager.name}</p>
              <p className="text-xs text-stone-500 truncate">{overview.manager.email}</p>
            </div>
            <span className="ml-auto badge-neutral text-[10px]">{formatRoleLabel(overview.manager.role)}</span>
          </div>
        </div>
      )}

      <section className="mt-6">
        <h2 className="section-title-ats">
          <Users className="w-4 h-4 text-brand-600" />
          Direct reports
          {(overview.reports || []).length > 0 && (
            <span className="ml-auto text-xs font-bold text-stone-400 normal-case tracking-normal">
              {overview.reports.length}
            </span>
          )}
        </h2>
        {loading ? (
          <div className="card-ats-bordered p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 skeleton-ats rounded-xl" />)}
          </div>
        ) : (overview.reports || []).length === 0 ? (
          <div className="card-ats-bordered">
            <EmptyState
              icon={Users}
              tone="brand"
              message="No one reports to you yet"
              subMessage="Add an intern or teammate. Their work then shows in your inbox under Team."
              action={(
                <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
                  <UserPlus className="w-4 h-4" /> Add teammate
                </button>
              )}
            />
          </div>
        ) : (
          <div className="card-ats-bordered overflow-hidden">
            <div className="divide-y divide-stone-100">
              {overview.reports.map((person) => (
                <div key={person.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                  <PresenceAvatar name={person.name} email={person.email} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900 truncate">{person.name}</p>
                    <p className="text-xs text-stone-500 truncate">{person.email}</p>
                  </div>
                  <span className="hidden sm:inline badge-neutral text-[10px]">{formatRoleLabel(person.role)}</span>
                  <button
                    type="button"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:text-red-600 hover:border-red-200"
                    title="Remove from my team"
                    onClick={() => setRemoveTarget(person)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="section-title-ats">
          <Tags className="w-4 h-4 text-brand-600" />
          Tags
          {(overview.tags || []).length > 0 && (
            <span className="ml-auto text-xs font-bold text-stone-400 normal-case tracking-normal">
              {overview.tags.length}
            </span>
          )}
        </h2>
        <p className="text-sm text-stone-500 -mt-2 mb-4">
          Create groups like <span className="font-semibold text-stone-700">@interns</span> or <span className="font-semibold text-stone-700">@campus</span>.
          Anyone in your company can mention the handle on a candidate — only tagged people are notified.
        </p>
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1, 2].map((i) => <div key={i} className="h-36 skeleton-ats rounded-2xl" />)}
          </div>
        ) : (overview.tags || []).length === 0 ? (
          <div className="card-ats-bordered">
            <EmptyState
              icon={Tags}
              tone="amber"
              message="No tags yet"
              subMessage="Tags are your personal pods. Add people from this company only."
              action={(
                <button type="button" className="btn-primary" onClick={openCreateTag}>
                  <Plus className="w-4 h-4" /> Create a tag
                </button>
              )}
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {overview.tags.map((tag) => (
              <article key={tag.id} className="card-ats-bordered p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border ${tagChipClass(tag.color)}`}>
                    <AtSign className="w-3 h-3" />
                    {tag.handle}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" className="text-xs font-semibold text-brand-700 hover:text-brand-800" onClick={() => openEditTag(tag)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-stone-400 hover:text-red-600"
                      onClick={() => setDeleteTag(tag)}
                      aria-label={`Delete ${tag.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-stone-900">{tag.name}</h3>
                <p className="text-[11px] text-stone-400">{tag.memberCount} {tag.memberCount === 1 ? 'person' : 'people'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(tag.members || []).slice(0, 6).map((m) => (
                    <span key={m.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-stone-100 text-stone-600 truncate max-w-[9rem]">
                      {m.name}
                    </span>
                  ))}
                  {tag.memberCount > 6 && (
                    <span className="text-[10px] font-semibold text-stone-400">+{tag.memberCount - 6}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-[11px] text-stone-400 flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5" />
        Tags and teammates stay inside your company. People outside the org cannot be added or mentioned.
      </p>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add teammate"
        description="They’ll report to you. Their candidate work appears in your Team inbox."
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)} disabled={adding}>Cancel</button>
            <button type="button" className="btn-primary" onClick={addReport} disabled={adding || !addUserId}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Add to my team
            </button>
          </>
        )}
      >
        <PremiumSelect
          value={addUserId}
          onChange={(v) => setAddUserId(v || '')}
          options={colleagueOptions}
          placeholder="Pick someone in your company"
          icon={Users}
          searchable
        />
        <p className="text-[12px] text-stone-500 mt-3 leading-relaxed">
          If they already report to someone else, only an admin can move them.
        </p>
      </Modal>

      <Modal
        open={Boolean(tagModal)}
        onClose={() => setTagModal(null)}
        title={tagModal?.mode === 'edit' ? 'Edit tag' : 'New tag'}
        description="A handle like @interns notifies everyone on the tag when mentioned."
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setTagModal(null)} disabled={savingTag}>Cancel</button>
            <button type="button" className="btn-primary" onClick={saveTag} disabled={savingTag}>
              {savingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tags className="w-4 h-4" />}
              {tagModal?.mode === 'edit' ? 'Save tag' : 'Create tag'}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <div>
            <label className="label-ats">Name</label>
            <input
              className="input-ats"
              value={tagForm.name}
              onChange={(e) => setTagForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Interns, Campus, North pod…"
            />
            {handle ? (
              <p className="text-[11px] text-brand-700 font-semibold mt-1.5 inline-flex items-center gap-1">
                <AtSign className="w-3 h-3" /> {handle}
              </p>
            ) : null}
          </div>
          <div>
            <label className="label-ats">Color</label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setTagForm((prev) => ({ ...prev, color: c.value }))}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${c.chip} ${
                    tagForm.color === c.value ? 'ring-2 ring-brand-400' : ''
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label-ats">People</label>
            <PremiumSelect
              multiple
              value={tagForm.memberIds}
              onChange={(v) => setTagForm((prev) => ({ ...prev, memberIds: v || [] }))}
              options={[
                ...new Map(
                  [...(overview.colleagues || []), ...(overview.reports || []), ...(overview.tags || []).flatMap((t) => t.members || [])]
                    .filter((c) => c?.id)
                    .map((c) => [c.id, { value: c.id, label: c.name || c.email, description: c.email }])
                ).values(),
              ]}
              placeholder="Add people from this company"
              icon={Users}
              searchable
            />
            {tagForm.memberIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tagForm.memberIds.map((id) => {
                  const person = [...(overview.colleagues || []), ...(overview.reports || [])].find((p) => p.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-stone-100 rounded-lg px-2 py-0.5">
                      {person?.name || 'Teammate'}
                      <button
                        type="button"
                        onClick={() => setTagForm((prev) => ({
                          ...prev,
                          memberIds: prev.memberIds.filter((x) => x !== id),
                        }))}
                      >
                        <X className="w-3 h-3 text-stone-400" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title="Remove from your team?"
        message={`${removeTarget?.name || 'This person'} will no longer report to you. Their inbox is unchanged.`}
        confirmText="Remove"
        type="delete"
        isLoading={busy}
      />
      <ConfirmationModal
        isOpen={!!deleteTag}
        onClose={() => setDeleteTag(null)}
        onConfirm={confirmDeleteTag}
        title="Delete this tag?"
        message={`@${deleteTag?.handle || ''} will stop notifying its members.`}
        confirmText="Delete"
        type="delete"
        isLoading={busy}
      />
    </div>
  );
}
