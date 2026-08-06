import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import ProductTour, { shouldAutoStartTour } from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import { TOUR_KEY, COLLAB_TOUR_STEPS } from './candidateCollaboration/collaborationConstants';
import { CollabCandidateList, CollabThreadPanel } from './candidateCollaboration/CollaborationPanels';

export default function CandidateCollaborationPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [listMode, setListMode] = useState('recent');
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (shouldAutoStartTour(TOUR_KEY)) {
      const t = setTimeout(() => setTourOpen(true), 450);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  const loadCandidates = useCallback(async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (q.trim()) {
        params.set('search', q.trim());
        setListMode('search');
      } else {
        setListMode('recent');
      }
      const res = await authenticatedFetch(`/candidates?${params}`);
      const data = await readApiJson(res);
      setCandidates(data.data || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load candidates');
    } finally {
      setSearching(false);
    }
  }, [q, toast]);

  useEffect(() => {
    const t = setTimeout(loadCandidates, 250);
    return () => clearTimeout(t);
  }, [loadCandidates]);

  const loadComments = useCallback(async (candidateId) => {
    if (!candidateId) return;
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/comments/candidate/${candidateId}`);
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setComments(data.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const selectCandidate = (c) => {
    setSelected(c);
    setBody('');
    loadComments(c._id);
  };

  const post = async () => {
    if (!selected || !body.trim()) return;
    setSending(true);
    try {
      const res = await authenticatedFetch(`/api/comments/candidate/${selected._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setBody('');
      await loadComments(selected._id);
      toast.success('Comment posted');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const onComposerKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      post();
    }
  };

  const removeComment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/comments/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to delete');
      toast.success('Comment deleted');
      setDeleteTarget(null);
      if (selected) await loadComments(selected._id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const listLabel = useMemo(() => {
    if (searching) return 'Loading…';
    if (listMode === 'search') {
      return candidates.length ? `${candidates.length} match${candidates.length === 1 ? '' : 'es'}` : 'No matches';
    }
    return candidates.length ? `${candidates.length} recent` : 'No candidates yet';
  }, [searching, listMode, candidates.length]);

  const tourSteps = useMemo(() => {
    if (!selected) {
      return COLLAB_TOUR_STEPS.filter((s) => s.target !== '[data-tour="collab-composer"]');
    }
    return COLLAB_TOUR_STEPS;
  }, [selected]);

  return (
    <FeatureGate
      feature="candidates.collaboration"
      fallback={
        <UpgradeFeatureFallback
          title="Team collaboration is a Professional feature"
          description="Upgrade to comment on candidates with @mentions for your hiring team."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={MessageSquare}
          title="Team Collaboration"
          subtitle="Internal notes and @mentions on candidates — visible to your hiring team."
          gradientTitle
        >
          {selected && (
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => loadComments(selected._id)}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          )}
        </PageHeader>

        <div className="rounded-xl border border-brand-200/70 bg-brand-50/40 px-4 py-3 text-sm text-stone-700 leading-relaxed">
          <p>
            <span className="font-semibold text-stone-900">@FirstName</span> or{' '}
            <span className="font-semibold text-stone-900">@emailPrefix</span> mentions notify teammates in-app.
            Use the help icon (bottom right) for a quick tour.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch min-h-[32rem]">
          <CollabCandidateList
            listLabel={listLabel}
            listMode={listMode}
            q={q}
            setQ={setQ}
            searching={searching}
            candidates={candidates}
            selected={selected}
            selectCandidate={selectCandidate}
          />
          <CollabThreadPanel
            selected={selected}
            loading={loading}
            comments={comments}
            body={body}
            setBody={setBody}
            sending={sending}
            post={post}
            onComposerKeyDown={onComposerKeyDown}
            setDeleteTarget={setDeleteTarget}
          />
        </div>

        <TourHelpFab
          onClick={() => setTourOpen(true)}
          label="Take a tour"
          title="Take a tour of Collaboration"
        />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={tourSteps}
          storageKey={TOUR_KEY}
        />

        <ConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={removeComment}
          title="Delete comment?"
          message="This comment will be permanently removed from the candidate thread."
          confirmText="Delete"
          type="delete"
          isLoading={deleting}
        />
      </div>
    </FeatureGate>
  );
}
