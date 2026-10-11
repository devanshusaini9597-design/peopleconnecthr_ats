import React, { useState, useEffect } from 'react';
import { Send, Loader2, Search } from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export const InviteModal = ({ assessment, open, onClose, onSent }) => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [sending, setSending] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(assessment?.jobId?._id || assessment?.jobId || '');
  const [applicants, setApplicants] = useState([]);
  const [bulkSending, setBulkSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      return;
    }
    setJobId(assessment?.jobId?._id || assessment?.jobId || '');
    authenticatedFetch('/api/assessments/jobs')
      .then((res) => res.json())
      .then((data) => { if (data.success) setJobs(data.data || []); })
      .catch(() => {});
  }, [open, assessment]);

  useEffect(() => {
    if (!open || !jobId) { setApplicants([]); return undefined; }
    authenticatedFetch(`/api/assessments/jobs/${jobId}/applicants${assessment?.pipelineStage ? `?stage=${encodeURIComponent(assessment.pipelineStage)}` : ''}`)
      .then((res) => res.json())
      .then((data) => { if (data.success) setApplicants(data.data || []); })
      .catch(() => setApplicants([]));
    return undefined;
  }, [open, jobId, assessment?.pipelineStage]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      try {
        const res = await authenticatedFetch(`/api/assessments/candidates?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (data.success) setResults(data.data || []);
      } catch { /* best-effort */ }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, open]);

  const handleInvite = async (candidate, applicationId) => {
    setSending(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/${assessment._id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ candidateId: candidate._id, applicationId, jobId: jobId || undefined })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Unable to send the invitation');
        return;
      }
      toast?.success?.(data.data?.emailSent
        ? `Assessment sent to ${candidate.name}.`
        : `Invitation created for ${candidate.name}. The email could not be delivered.`);
      onSent();
      onClose();
    } catch {
      toast?.error?.('Unable to send the invitation');
    } finally {
      setSending(false);
    }
  };

  const bulkInvite = async () => {
    if (!jobId) return;
    setBulkSending(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/${assessment._id}/invite-job`, {
        method: 'POST',
        body: JSON.stringify({ jobId, stage: assessment.pipelineStage || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Bulk invite failed');
        return;
      }
      toast?.success?.(`${data.data.invited} invitations sent (${data.data.skipped} skipped).`);
      onSent();
      onClose();
    } catch {
      toast?.error?.('Bulk invite failed');
    } finally {
      setBulkSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite candidates"
      description={`Send “${assessment.title}” with a time-limited link. Linked applications keep ranking job-specific.`}
      size="md"
    >
      <label className="label-ats">Job</label>
      <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="input-ats mb-3">
        <option value="">Search any internal candidate</option>
        {jobs.map((job) => (
          <option key={job._id} value={job._id}>{job.title || job.role}</option>
        ))}
      </select>

      {jobId ? (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-stone-500">
              {assessment.pipelineStage ? `Applicants in “${assessment.pipelineStage}”` : 'Active applicants'}
            </p>
            <button type="button" className="btn-primary !text-xs !py-1.5" disabled={bulkSending || !applicants.length} onClick={bulkInvite}>
              {bulkSending ? 'Sending…' : `Invite all (${applicants.length})`}
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5 mb-3">
            {applicants.map((app) => (
              <button
                key={app._id}
                type="button"
                onClick={() => handleInvite(app.candidateId, app._id)}
                disabled={sending || !app.candidateId}
                className="list-row-ats w-full text-left justify-between disabled:opacity-50"
              >
                <div>
                  <div className="text-sm font-semibold">{app.candidateId?.name}</div>
                  <div className="text-xs text-stone-500">{app.stage} · {app.candidateId?.email}</div>
                </div>
                <Send className="w-4 h-4 text-brand-600" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidates…"
          className="input-ats input-ats-icon"
          autoFocus
        />
      </div>
      <div className="mt-3 max-h-64 overflow-y-auto space-y-0.5">
        {results.length === 0 ? (
          <EmptyState
            icon={Search}
            tone={query ? 'amber' : 'sky'}
            compact
            message={query ? 'No candidates found' : 'Search candidates'}
            subMessage={query ? 'Try a different name or email.' : 'Start typing a name or email.'}
          />
        ) : results.map((c) => (
          <button
            key={c._id}
            type="button"
            onClick={() => handleInvite(c)}
            disabled={sending}
            className="list-row-ats w-full text-left justify-between disabled:opacity-50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {(c.name || 'N')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-stone-900 truncate">{c.name}</div>
                <div className="text-xs text-stone-500 truncate">{c.email}</div>
              </div>
            </div>
            {sending ? <Loader2 className="w-4 h-4 text-brand-600 animate-spin" /> : <Send className="w-4 h-4 text-brand-600" />}
          </button>
        ))}
      </div>
    </Modal>
  );
};
