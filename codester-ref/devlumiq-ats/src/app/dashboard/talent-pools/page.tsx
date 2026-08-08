'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Plus, Loader2, Search, Send, UserPlus, Archive, Sparkles,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { PermissionGate } from '@/components/PermissionGate';

interface Pool {
  id: string;
  name: string;
  description?: string | null;
  poolType: string;
  _count?: { members: number };
}

interface MemberRow {
  id: string;
  addedReason?: string | null;
  lastContactedAt?: string | null;
  tags?: unknown;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    location?: string | null;
    skills?: unknown;
    currentTitle?: string | null;
    talentPoolConsent: boolean;
  };
}

const POOL_TYPES = [
  { value: 'silver_medalist', label: 'Silver medalist' },
  { value: 'keep_warm', label: 'Keep warm' },
  { value: 'future_fit', label: 'Future fit' },
  { value: 'skill', label: 'Skill-based' },
  { value: 'general', label: 'General' },
];

export default function TalentPoolsPage() {
  const toast = useToast();
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSkills, setFilterSkills] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterContactedBefore, setFilterContactedBefore] = useState('');
  const [filterContactedAfter, setFilterContactedAfter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newPool, setNewPool] = useState({ name: '', description: '', poolType: 'silver_medalist' });
  const [campaign, setCampaign] = useState({ channel: 'EMAIL', subject: '', message: '', sequenceId: '' });
  const [sequences, setSequences] = useState<Array<{ id: string; name: string }>>([]);
  const [addCandidateId, setAddCandidateId] = useState('');
  const [addReason, setAddReason] = useState('keep warm');
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [suggestJobId, setSuggestJobId] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{
    candidateId: string; name: string; matchPercent: number; poolName: string; email: string;
  }>>([]);
  const [busy, setBusy] = useState(false);

  const loadPools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/talent-pools', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPools(data.pools ?? []);
      if (!selectedId && data.pools?.[0]) setSelectedId(data.pools[0].id);
    } catch {
      toast.error('Error', 'Failed to load talent pools');
    } finally {
      setLoading(false);
    }
  }, [selectedId, toast]);

  const loadMembers = useCallback(async (poolId: string) => {
    const params = new URLSearchParams();
    if (filterSkills.trim()) params.set('skills', filterSkills.trim());
    if (filterLocation.trim()) params.set('location', filterLocation.trim());
    if (filterContactedBefore) params.set('contactedBefore', filterContactedBefore);
    if (filterContactedAfter) params.set('contactedAfter', filterContactedAfter);
    const res = await fetch(`/api/talent-pools/${poolId}?${params}`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setMembers(data.members ?? []);
  }, [filterSkills, filterLocation, filterContactedBefore, filterContactedAfter]);

  useEffect(() => { void loadPools(); }, [loadPools]);
  useEffect(() => {
    if (selectedId) void loadMembers(selectedId);
  }, [selectedId, loadMembers]);

  useEffect(() => {
    fetch('/api/candidates?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCandidates((d?.candidates ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    fetch('/api/jobs', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setJobs((d?.jobs ?? []).map((j: { id: string; title: string }) => ({ id: j.id, title: j.title }))))
      .catch(() => {});
    fetch('/api/email/sequences', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = Array.isArray(d) ? d : (d?.sequences ?? []);
        setSequences(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
  }, []);

  const createPool = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/talent-pools', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPool),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Pool created', data.pool.name);
      setCreateOpen(false);
      setNewPool({ name: '', description: '', poolType: 'silver_medalist' });
      await loadPools();
      setSelectedId(data.pool.id);
    } catch (e: unknown) {
      toast.error('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const addMember = async () => {
    if (!selectedId || !addCandidateId) return;
    setBusy(true);
    try {
      const grant = await fetch('/api/talent-pools/consent', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: addCandidateId, consent: true }),
      });
      if (!grant.ok) {
        const g = await grant.json().catch(() => ({}));
        throw new Error(g.error || 'Could not record pool consent');
      }

      const res = await fetch(`/api/talent-pools/${selectedId}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: addCandidateId, addedReason: addReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.added ?? 0) === 0) {
        throw new Error(data.error || data.skipped?.[0]?.reason || 'Failed to add member');
      }

      toast.success('Added', 'Candidate added to pool (consent recorded)');
      setAddOpen(false);
      await loadMembers(selectedId);
      await loadPools();
    } catch (e: unknown) {
      toast.error('Add failed', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const runCampaign = async () => {
    if (!selectedId || !campaign.message.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/talent-pools/${selectedId}/campaign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: campaign.channel,
          subject: campaign.subject,
          message: campaign.message,
          ...(campaign.sequenceId ? { sequenceId: campaign.sequenceId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Campaign sent', `${data.sent} sent · ${data.skipped} skipped · ${data.failed} failed`);
      setCampaignOpen(false);
      setCampaign({ channel: 'EMAIL', subject: '', message: '', sequenceId: '' });
      await loadMembers(selectedId);
    } catch (e: unknown) {
      toast.error('Campaign', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const loadSuggestions = async () => {
    if (!suggestJobId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/talent-pools/suggest?jobId=${suggestJobId}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSuggestions(data.suggestions ?? []);
    } catch (e: unknown) {
      toast.error('Suggest', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const seedDemoPools = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/talent-pools/seed-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load sample data');

      const listRes = await fetch('/api/talent-pools', { credentials: 'include' });
      const listData = await listRes.json().catch(() => ({}));
      if (!listRes.ok) throw new Error(listData.error || 'Failed to reload pools');
      const nextPools = listData.pools ?? [];
      setPools(nextPools);
      setSelectedId(nextPools[0]?.id ?? null);
      toast.success('Sample data ready', `${data.pools ?? nextPools.length} pools · ${data.members ?? 0} members`);
    } catch (e) {
      toast.error('Error', e instanceof Error ? e.message : 'Could not seed pools');
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  const selected = pools.find((p) => p.id === selectedId);

  return (
    <PageShell>
      <PageHeader
        icon={Users}
        title="Talent pools"
        subtitle="Silver medalists & keep-warm CRM — consent required to retain"
      >
        <PermissionGate permission="CREATE_CANDIDATE">
          <div className="flex flex-wrap items-center gap-2">
            {pools.length === 0 && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={busy}
                onClick={() => void seedDemoPools()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Load sample data
              </motion.button>
            )}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> New pool
            </motion.button>
          </div>
        </PermissionGate>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-stone-400" /></div>
          ) : pools.length === 0 ? (
            <div className="p-4 text-center space-y-3">
              <Archive className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-sm text-stone-500">No pools yet.</p>
              <PermissionGate permission="CREATE_CANDIDATE">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void seedDemoPools()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Load sample data
                </button>
              </PermissionGate>
            </div>
          ) : (
            pools.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                  selectedId === p.id ? 'border-brand-300 bg-brand-50' : 'border-transparent hover:bg-stone-50'
                }`}
              >
                <p className="text-sm font-semibold text-stone-900">{p.name}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {POOL_TYPES.find((t) => t.value === p.poolType)?.label || p.poolType}
                  {' · '}
                  {p._count?.members ?? 0} members
                </p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2 space-y-3">
          {selected ? (
            <>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <h2 className="font-bold text-stone-900">{selected.name}</h2>
                  <p className="text-xs text-stone-500">{selected.description || 'No description'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold">
                    <UserPlus className="w-3.5 h-3.5" /> Add
                  </button>
                  <button type="button" onClick={() => setCampaignOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold">
                    <Send className="w-3.5 h-3.5" /> Campaign
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-3 flex flex-wrap gap-2 items-end">
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <input value={filterSkills} onChange={(e) => setFilterSkills(e.target.value)} placeholder="Filter skills…" className="w-full pl-8 pr-2 py-2 rounded-lg border border-stone-200 text-xs" />
                </div>
                <input value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} placeholder="Location…" className="flex-1 min-w-[120px] px-2 py-2 rounded-lg border border-stone-200 text-xs" />
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-stone-500">
                  Contacted after
                  <input type="date" value={filterContactedAfter} onChange={(e) => setFilterContactedAfter(e.target.value)} className="px-2 py-2 rounded-lg border border-stone-200 text-xs text-stone-800 font-normal" />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-stone-500">
                  Contacted before
                  <input type="date" value={filterContactedBefore} onChange={(e) => setFilterContactedBefore(e.target.value)} className="px-2 py-2 rounded-lg border border-stone-200 text-xs text-stone-800 font-normal" />
                </label>
                <button type="button" onClick={() => selectedId && void loadMembers(selectedId)} className="px-3 py-2 rounded-lg bg-stone-100 text-xs font-semibold">Apply</button>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100 max-h-[40vh] overflow-y-auto">
                {members.length === 0 ? (
                  <p className="p-6 text-sm text-stone-500 text-center">No members match filters.</p>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{m.candidate.name}</p>
                        <p className="text-xs text-stone-500">
                          {m.candidate.currentTitle || '—'} · {m.candidate.location || 'Remote/—'}
                          {m.addedReason ? ` · ${m.addedReason}` : ''}
                        </p>
                      </div>
                      <p className="text-[11px] text-stone-400">
                        {m.lastContactedAt
                          ? `Contacted ${new Date(m.lastContactedAt).toLocaleDateString()}`
                          : 'Never contacted'}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
                <p className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-600" /> Suggest for open job
                </p>
                <div className="flex flex-wrap gap-2">
                  <select value={suggestJobId} onChange={(e) => setSuggestJobId(e.target.value)} className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm">
                    <option value="">Select job…</option>
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                  <button type="button" disabled={!suggestJobId || busy} onClick={() => void loadSuggestions()} className="px-4 py-2 rounded-xl bg-stone-900 text-white text-sm font-semibold disabled:opacity-50">
                    Find matches
                  </button>
                </div>
                {suggestions.length > 0 && (
                  <ul className="space-y-1.5 text-sm max-h-40 overflow-y-auto">
                    {suggestions.map((s) => (
                      <li key={s.candidateId} className="flex justify-between gap-2 px-2 py-1.5 rounded-lg bg-stone-50">
                        <span>{s.name} <span className="text-stone-400">({s.poolName})</span></span>
                        <span className="font-semibold text-brand-700">{s.matchPercent}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-200 p-12 text-center text-stone-500 text-sm">
              <Archive className="w-8 h-8 mx-auto mb-2 text-stone-300" />
              Select or create a pool
            </div>
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create talent pool" size="md">
        <div className="space-y-3">
          <input value={newPool.name} onChange={(e) => setNewPool((p) => ({ ...p, name: e.target.value }))} placeholder="Pool name" className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
          <select value={newPool.poolType} onChange={(e) => setNewPool((p) => ({ ...p, poolType: e.target.value }))} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm">
            {POOL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <textarea value={newPool.description} onChange={(e) => setNewPool((p) => ({ ...p, description: e.target.value }))} placeholder="Description" rows={2} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
          <button type="button" disabled={busy || !newPool.name.trim()} onClick={() => void createPool()} className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
            Create
          </button>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add to pool" description="Records GDPR talent-pool retention consent when adding." size="md">
        <div className="space-y-3">
          <select value={addCandidateId} onChange={(e) => setAddCandidateId(e.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm">
            <option value="">Select candidate…</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={addReason} onChange={(e) => setAddReason(e.target.value)} placeholder="Reason (e.g. rejected — keep warm)" className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
          <button type="button" disabled={busy || !addCandidateId} onClick={() => void addMember()} className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
            Add with consent
          </button>
        </div>
      </Modal>

      <Modal open={campaignOpen} onClose={() => setCampaignOpen(false)} title="Re-engagement campaign" size="md">
        <div className="space-y-3">
          <select value={campaign.channel} onChange={(e) => setCampaign((c) => ({ ...c, channel: e.target.value }))} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm">
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS (requires smsOptIn)</option>
          </select>
          {campaign.channel === 'EMAIL' && (
            <input value={campaign.subject} onChange={(e) => setCampaign((c) => ({ ...c, subject: e.target.value }))} placeholder="Subject" className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
          )}
          <select
            value={campaign.sequenceId}
            onChange={(e) => setCampaign((c) => ({ ...c, sequenceId: e.target.value }))}
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
          >
            <option value="">No email sequence</option>
            {sequences.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <textarea
            value={campaign.message}
            onChange={(e) => setCampaign((c) => ({ ...c, message: e.target.value }))}
            placeholder="Hi {{candidateName}}, we have a new role that may fit…"
            rows={4}
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
          />
          <button type="button" disabled={busy || !campaign.message.trim()} onClick={() => void runCampaign()} className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
            Send to pool
          </button>
        </div>
      </Modal>
    </PageShell>
  );
}
