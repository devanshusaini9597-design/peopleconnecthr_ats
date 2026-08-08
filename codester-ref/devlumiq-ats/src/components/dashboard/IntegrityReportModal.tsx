'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface Props {
  assignmentId: string | null;
  open: boolean;
  onClose: () => void;
}

export function IntegrityReportModal({ assignmentId, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!open || !assignmentId) return;
    setLoading(true);
    fetch(`/api/assessments/${assignmentId}/integrity-report`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, assignmentId]);

  const p = data?.proctoring;

  return (
    <Modal open={open} onClose={onClose} title="Integrity report" size="lg">
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : !data ? (
        <p className="text-sm text-stone-500">No report available.</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-semibold text-stone-900">{data.candidate?.name}</span>
            <span className="text-stone-400">·</span>
            <span>{data.template?.name}</span>
            {p?.flagged && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold border border-red-100">
                <ShieldAlert className="w-3.5 h-3.5" /> Flagged
              </span>
            )}
          </div>
          {p ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Risk" value={p.riskScore} />
                <Stat label="Tab switches" value={p.tabSwitchCount} />
                <Stat label="Copy/paste" value={p.copyPasteCount} />
                <Stat label="Fullscreen exits" value={p.fullscreenExits} />
              </div>
              {p.plagiarismScore != null && (
                <p className="text-xs text-stone-600">
                  Plagiarism similarity: {Math.round(p.plagiarismScore * 100)}%
                  {p.plagiarismNotes ? ` — ${p.plagiarismNotes}` : ''}
                </p>
              )}
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-1">Timeline</p>
                <ul className="max-h-48 overflow-y-auto space-y-1 text-xs bg-stone-50 rounded-xl p-3 border border-stone-100">
                  {(Array.isArray(p.timeline) ? p.timeline : []).slice(-50).map((e: any, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-stone-400 whitespace-nowrap">{e.at ? new Date(e.at).toLocaleTimeString() : '—'}</span>
                      <span className="font-medium text-stone-800">{e.type}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-1">
                  Webcam snapshots ({p.snapshots?.length || 0})
                </p>
                <div className="flex flex-wrap gap-2">
                  {(p.snapshots || []).slice(0, 12).map((s: { at: string; url?: string | null }, i: number) =>
                    s.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block">
                        <img src={s.url} alt={`Snapshot ${i + 1}`} className="w-16 h-12 object-cover rounded border border-stone-200" />
                      </a>
                    ) : (
                      <span key={i} className="text-[10px] text-stone-400 px-2 py-1 border rounded">
                        {s.at ? new Date(s.at).toLocaleTimeString() : '—'}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-stone-500">Proctoring was not enabled for this assignment.</p>
          )}
          <p className="text-xs text-stone-500">
            Score: {data.assignment?.score ?? '—'}/{data.assignment?.maxScore ?? '—'}
            {data.assignment?.percentage != null ? ` (${Math.round(data.assignment.percentage)}%)` : ''}
          </p>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
      <p className="text-[10px] uppercase font-bold text-stone-400">{label}</p>
      <p className="text-lg font-bold text-stone-900">{value}</p>
    </div>
  );
}
