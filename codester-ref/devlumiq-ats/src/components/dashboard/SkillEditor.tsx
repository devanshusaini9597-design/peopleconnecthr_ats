'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, X, Save } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type SkillOption = { id: string; name: string; category: string };
type CandidateSkillRow = {
  skillId: string;
  proficiency: number;
  skill: { id: string; name: string; category: string };
};

export function SkillEditor({ candidateId }: { candidateId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<SkillOption[]>([]);
  const [selected, setSelected] = useState<Array<{ skillId: string; name: string; proficiency: number }>>([]);
  const [pickId, setPickId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [skillsRes, candRes] = await Promise.all([
          fetch('/api/skills?limit=200', { credentials: 'include' }),
          fetch(`/api/candidates/${candidateId}/skills`, { credentials: 'include' }),
        ]);
        const skillsJson = skillsRes.ok ? await skillsRes.json() : { skills: [] };
        const candJson = candRes.ok ? await candRes.json() : { skills: [] };
        if (cancelled) return;
        setCatalog(
          (skillsJson.skills || []).map((s: SkillOption) => ({
            id: s.id,
            name: s.name,
            category: s.category,
          })),
        );
        setSelected(
          ((candJson.skills || []) as CandidateSkillRow[]).map((row) => ({
            skillId: row.skillId || row.skill?.id,
            name: row.skill?.name || '',
            proficiency: row.proficiency ?? 3,
          })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const addSkill = () => {
    if (!pickId) return;
    if (selected.some((s) => s.skillId === pickId)) return;
    const skill = catalog.find((c) => c.id === pickId);
    if (!skill) return;
    setSelected((prev) => [...prev, { skillId: skill.id, name: skill.name, proficiency: 3 }]);
    setPickId('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/skills`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: selected.map((s) => ({
            skillId: s.skillId,
            proficiency: s.proficiency,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Skills saved');
    } catch (e: unknown) {
      toast.error('Skills', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading skills…
      </div>
    );
  }

  const available = catalog.filter((c) => !selected.some((s) => s.skillId === c.id));

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Taxonomy skills</p>
      <div className="flex flex-wrap gap-2">
        {selected.length === 0 && (
          <p className="text-sm text-stone-400 italic">No taxonomy skills linked yet</p>
        )}
        {selected.map((s) => (
          <span
            key={s.skillId}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200 text-xs font-medium text-brand-800"
          >
            {s.name}
            <select
              value={s.proficiency}
              onChange={(e) =>
                setSelected((prev) =>
                  prev.map((x) =>
                    x.skillId === s.skillId ? { ...x, proficiency: Number(e.target.value) } : x,
                  ),
                )
              }
              className="bg-white border border-brand-100 rounded text-[10px] px-1 py-0.5"
              title="Proficiency 1–5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSelected((prev) => prev.filter((x) => x.skillId !== s.skillId))}
              className="text-brand-500 hover:text-red-600"
              aria-label={`Remove ${s.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={pickId}
          onChange={(e) => setPickId(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-stone-200 text-sm"
        >
          <option value="">Add skill…</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.category})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addSkill}
          disabled={!pickId}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-stone-200 text-xs font-semibold disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save skills
        </button>
      </div>
    </div>
  );
}
