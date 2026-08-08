'use client';

import { useEffect, useState } from 'react';
import { Loader2, Target } from 'lucide-react';

interface Props {
  jobId: string;
  candidateId: string;
  className?: string;
}

export function SkillMatchBadge({ jobId, candidateId, className = '' }: Props) {
  const [percent, setPercent] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/skills/match?jobId=${encodeURIComponent(jobId)}&candidateId=${encodeURIComponent(candidateId)}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const p = data.match?.matchPercent;
        setPercent(typeof p === 'number' ? p : null);
        setNote(data.match?.note ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [jobId, candidateId]);

  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-stone-400 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" /> Skills…
      </span>
    );
  }

  if (percent === null) {
    return note ? (
      <span className={`inline-flex items-center gap-1 text-xs text-stone-400 ${className}`} title={note}>
        <Target className="w-3 h-3" /> No job skills set
      </span>
    ) : null;
  }

  const tone =
    percent >= 80
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : percent >= 50
        ? 'bg-amber-50 text-amber-800 border-amber-100'
        : 'bg-stone-50 text-stone-600 border-stone-200';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${tone} ${className}`}
      title="Skills match % (taxonomy) — separate from AI rank"
    >
      <Target className="w-3 h-3" />
      {percent}% skills match
    </span>
  );
}
