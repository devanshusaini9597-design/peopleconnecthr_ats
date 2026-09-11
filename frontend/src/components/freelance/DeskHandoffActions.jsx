import React, { useEffect, useMemo, useState } from 'react';
import {
  History, Loader2, Pencil, Trash2, UserCog,
} from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../utils/fetchUtils';
import { formatRoleLabel } from '../organization/constants';

function relativeTime(value) {
  if (!value) return '—';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || '');
}

function personLabel(person) {
  if (!person) return '';
  return person.name || person.email || 'Team member';
}

/**
 * Desk actions open in modals (enterprise pattern) — never expand inline under the board.
 */
export default function DeskHandoffActions({
  row,
  saving,
  reviewers: reviewersProp = [],
  canHardDelete = false,
  onReassign,
  onEditCandidate,
  onHardDelete,
}) {
  const [panel, setPanel] = useState(null);
  const [spocId, setSpocId] = useState('');
  const [form, setForm] = useState({});
  const [reviewers, setReviewers] = useState(reviewersProp);
  const [loadingReviewers, setLoadingReviewers] = useState(false);
  const [loadingCandidate, setLoadingCandidate] = useState(false);

  const candidate = row.candidateId || {};
  const snap = row.candidateSnapshot || {};
  const history = Array.isArray(row.history) ? [...row.history].reverse() : [];
  const currentSpoc = row.spocUserId && typeof row.spocUserId === 'object'
    ? row.spocUserId
    : null;

  const seedForm = (src = {}) => ({
    name: src.name || candidate.name || snap.name || '',
    email: src.email || candidate.email || snap.email || '',
    contact: src.contact || src.phone || candidate.contact || candidate.phone || snap.contact || '',
    position: src.position || candidate.position || snap.position || '',
    noticePeriod: src.noticePeriod || candidate.noticePeriod || '',
    expectedCtc: src.expectedCtc || src.ctc || candidate.expectedCtc || candidate.ctc || '',
    location: src.location || candidate.location || '',
  });

  useEffect(() => {
    setReviewers(reviewersProp);
  }, [reviewersProp]);

  useEffect(() => {
    setSpocId(idOf(row.spocUserId));
    setForm(seedForm());
  }, [row._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (panel !== 'reassign') return undefined;
    let cancelled = false;
    (async () => {
      setLoadingReviewers(true);
      try {
        const res = await authenticatedFetch('/api/freelancer/reviewers');
        if (isUnauthorized(res)) return handleUnauthorized();
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.data)) {
          setReviewers(data.data);
        }
      } catch {
        /* keep prop list */
      } finally {
        if (!cancelled) setLoadingReviewers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [panel]);

  useEffect(() => {
    if (panel !== 'edit') return undefined;
    const candidateId = idOf(row.candidateId);
    if (!candidateId) {
      setForm(seedForm());
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingCandidate(true);
      setForm(seedForm());
      try {
        const res = await authenticatedFetch(`/api/candidates/${candidateId}`);
        if (isUnauthorized(res)) return handleUnauthorized();
        const data = await res.json().catch(() => ({}));
        const live = data?.data || data?.candidate || data;
        if (!cancelled && res.ok && live && typeof live === 'object') {
          setForm(seedForm(live));
        }
      } catch {
        /* keep seeded row data */
      } finally {
        if (!cancelled) setLoadingCandidate(false);
      }
    })();
    return () => { cancelled = true; };
  }, [panel, row._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewerOptions = useMemo(() => {
    const map = new Map();
    for (const r of reviewers) {
      const id = idOf(r);
      if (!id) continue;
      map.set(id, {
        value: id,
        label: personLabel(r),
        description: [formatRoleLabel(r.role) || r.role, r.email].filter(Boolean).join(' · '),
        avatarName: personLabel(r),
        avatarEmail: r.email || '',
        photo: r.profilePicture || '',
        searchText: `${r.name || ''} ${r.email || ''} ${r.role || ''}`,
      });
    }
    // Always include current SPOC so the trigger never falls back to a raw ObjectId
    const curId = idOf(row.spocUserId);
    if (curId && !map.has(curId)) {
      map.set(curId, {
        value: curId,
        label: personLabel(currentSpoc) || 'Current hiring manager',
        description: [
          formatRoleLabel(currentSpoc?.role) || currentSpoc?.role,
          currentSpoc?.email,
        ].filter(Boolean).join(' · ') || 'Current assignee',
        avatarName: personLabel(currentSpoc) || 'HM',
        avatarEmail: currentSpoc?.email || '',
      });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [reviewers, row.spocUserId, currentSpoc]);

  const close = () => setPanel(null);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={saving || Boolean(row.archivedAt)}
          onClick={() => setPanel('reassign')}
          className="h-10 px-2.5 rounded-xl text-[12px] font-semibold text-stone-700 border border-stone-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <UserCog size={14} /> Transfer
        </button>
        <button
          type="button"
          disabled={saving || Boolean(row.archivedAt)}
          onClick={() => setPanel('edit')}
          className="h-10 px-2.5 rounded-xl text-[12px] font-semibold text-stone-700 border border-stone-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Pencil size={14} /> Edit profile
        </button>
        <button
          type="button"
          onClick={() => setPanel('history')}
          className="h-10 px-2.5 rounded-xl text-[12px] font-semibold text-stone-700 border border-stone-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm transition-all inline-flex items-center justify-center gap-1.5"
        >
          <History size={14} /> Activity log
        </button>
        {canHardDelete ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              const wipe = window.confirm('Permanently delete this submission? This cannot be undone.');
              if (!wipe) return;
              const also = window.confirm('Also remove the linked candidate from ATS? (Only if unused elsewhere)');
              onHardDelete?.(row._id, also);
            }}
            className="h-10 px-2.5 rounded-xl text-[12px] font-semibold text-red-700 border border-red-200 bg-red-50 hover:border-red-300 hover:shadow-sm transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete
          </button>
        ) : null}
      </div>

      <Modal
        open={panel === 'reassign'}
        onClose={close}
        title="Transfer ownership"
        description="Assign this submission to another internal reviewer. The previous owner loses desk access; the new owner sees it immediately."
        size="sm"
        icon={UserCog}
        disableFocusLock
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
            <button
              type="button"
              disabled={saving || !spocId || loadingReviewers}
              onClick={async () => {
                const ok = await onReassign?.(row._id, spocId);
                if (ok) close();
              }}
              className="btn-primary"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Confirm transfer
            </button>
          </>
        )}
      >
        <div className="space-y-3">
          {currentSpoc ? (
            <p className="text-[12px] text-stone-600 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
              Current owner:{' '}
              <span className="font-semibold text-stone-900">{personLabel(currentSpoc)}</span>
              {currentSpoc.email ? <span className="text-stone-500"> · {currentSpoc.email}</span> : null}
            </p>
          ) : null}
          <div>
            <label className="label-ats">Internal reviewer</label>
            <PremiumSelect
              value={spocId}
              onChange={setSpocId}
              options={reviewerOptions}
              searchable
              searchPlaceholder="Search by name or email…"
              placeholder={loadingReviewers ? 'Loading reviewers…' : 'Select reviewer'}
              emptyLabel="No internal reviewers found"
            />
            <p className="mt-2 text-[11px] text-stone-400">
              {loadingReviewers
                ? 'Loading company accounts…'
                : `${reviewerOptions.length} reviewer${reviewerOptions.length === 1 ? '' : 's'} available`}
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={panel === 'edit'}
        onClose={close}
        title="Edit candidate profile"
        description="Updates the ATS candidate record linked to this submission."
        size="md"
        icon={Pencil}
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
            <button
              type="button"
              disabled={saving || loadingCandidate}
              onClick={async () => {
                const ok = await onEditCandidate?.(row._id, form);
                if (ok) close();
              }}
              className="btn-primary"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save profile
            </button>
          </>
        )}
      >
        {loadingCandidate ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-stone-500">
            <Loader2 size={16} className="animate-spin text-brand-600" />
            Loading candidate profile…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {['name', 'email', 'contact', 'position', 'noticePeriod', 'expectedCtc', 'location'].map((key) => (
              <div key={key} className={key === 'location' ? 'sm:col-span-2' : ''}>
                <label className="label-ats capitalize">
                  {key === 'expectedCtc' ? 'Expected CTC' : key === 'noticePeriod' ? 'Notice period' : key}
                </label>
                <input
                  className="input-ats !h-10 rounded-xl border-stone-200 hover:border-brand-300 focus:border-brand-500"
                  value={form[key] || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={key === 'name' ? 'Candidate name' : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={panel === 'history'}
        onClose={close}
        title="Activity log"
        description="Stage changes, ownership transfers, edits, and archive events for this submission."
        size="md"
        icon={History}
        footer={<button type="button" className="btn-secondary" onClick={close}>Close</button>}
      >
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {history.length === 0 ? (
            <p className="text-sm text-stone-400 py-6 text-center">No activity recorded yet</p>
          ) : history.map((entry, i) => (
            <div
              key={`${entry.action}-${entry.at || i}`}
              className="rounded-xl border border-stone-200 bg-stone-50/80 px-3.5 py-3"
            >
              <p className="text-[13px] font-semibold text-stone-900 capitalize">
                {String(entry.action || '').replace(/_/g, ' ')}
              </p>
              <p className="text-[12px] text-stone-500 mt-0.5">
                {entry.byName || 'System'} · {relativeTime(entry.at)}
              </p>
              {entry.action === 'reassign_spoc' ? (
                <p className="text-[12px] text-brand-800 mt-1.5 font-medium">
                  {entry.meta?.fromName || 'Previous owner'}
                  {' → '}
                  {entry.meta?.toName || 'New owner'}
                </p>
              ) : null}
              {entry.meta?.status ? (
                <p className="text-[12px] text-stone-600 mt-1">Stage → {entry.meta.status}</p>
              ) : null}
              {entry.meta?.fields?.length ? (
                <p className="text-[12px] text-stone-600 mt-1">Fields: {entry.meta.fields.join(', ')}</p>
              ) : null}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
