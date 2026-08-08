'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, FileText, ClipboardCheck, Clock, Bot } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export type ScorecardSuggestion = {
  name: string;
  suggestedScore: number;
  rationale: string;
};

type KeyMoment = {
  label: string;
  startMs?: number;
  endMs?: number;
  at?: string;
};

interface Props {
  interviewId: string;
  /** Apply AI suggestions into the scorecard form — does not auto-submit */
  onApplySuggestions?: (suggestions: ScorecardSuggestion[]) => void;
}

function formatMs(ms?: number) {
  if (ms == null || Number.isNaN(ms)) return '';
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function InterviewTranscriptPanel({ interviewId, onApplySuggestions }: Props) {
  const toast = useToast();
  const [consent, setConsent] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [suggestions, setSuggestions] = useState<ScorecardSuggestion[]>([]);
  const [keyMoments, setKeyMoments] = useState<KeyMoment[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [highlightLabel, setHighlightLabel] = useState<string | null>(null);
  const [videoLink, setVideoLink] = useState('');
  const [botStatus, setBotStatus] = useState<string | null>(null);
  const [botConfigured, setBotConfigured] = useState(false);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/interviews/${interviewId}/transcript`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/interviews/${interviewId}/meeting-bot`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([d, bot]) => {
        if (d) {
          setConsent(!!d.interview?.recordingConsent);
          setTranscript(d.transcript?.rawTranscript || '');
          setAiSummary(d.transcript?.aiSummary || d.interview?.feedbackSummary || '');
          setSuggestions(
            Array.isArray(d.transcript?.scorecardSuggestions) ? d.transcript.scorecardSuggestions : [],
          );
          const moments = Array.isArray(d.transcript?.timestamps) ? d.transcript.timestamps : [];
          setKeyMoments(moments);
          if (typeof d.interview?.videoLink === 'string') setVideoLink(d.interview.videoLink);
          if (d.interview?.meetingBotStatus) setBotStatus(d.interview.meetingBotStatus);
        }
        if (bot) {
          setBotConfigured(!!bot.configured);
          if (bot.status) setBotStatus(bot.status);
          if (typeof bot.videoLink === 'string' && bot.videoLink) setVideoLink(bot.videoLink);
          if (typeof bot.recordingConsent === 'boolean') setConsent(bot.recordingConsent);
        }
      })
      .finally(() => setLoading(false));
  }, [interviewId]);

  const saveTranscript = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/transcript`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTranscript: transcript,
          recordingConsent: true,
          source: 'manual',
          timestamps: keyMoments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setConsent(true);
      toast.success('Saved', 'Transcript stored with recording consent');
    } catch (e: unknown) {
      toast.error('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const sendMeetingBot = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/meeting-bot`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoLink: videoLink.trim() || undefined,
          recordingConsent: consent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send bot');
      setConsent(true);
      setBotStatus(data.status || 'joining');
      toast.success('Meeting bot sent', data.botId ? `Bot ${data.botId.slice(0, 8)}… joining` : 'Joining meeting');
    } catch (e: unknown) {
      toast.error('Meeting bot', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const runAi = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/ai-summary`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applySummary: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'AI failed');
      setAiSummary(data.summary?.feedbackSummary || '');
      setSuggestions(data.summary?.scorecardSuggestions || []);
      const moments: KeyMoment[] =
        (Array.isArray(data.summary?.keyMoments) && data.summary.keyMoments.length
          ? data.summary.keyMoments
          : Array.isArray(data.transcript?.timestamps)
            ? data.transcript.timestamps
            : keyMoments) || [];
      setKeyMoments(moments);
      toast.success('AI summary ready', 'Review suggestions before submitting scorecards');
    } catch (e: unknown) {
      toast.error('AI summary', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const applyToForm = () => {
    if (!onApplySuggestions || suggestions.length === 0) return;
    onApplySuggestions(suggestions);
    toast.success('Prefill applied', 'Scores and notes filled — review, then Save Scores');
  };

  const jumpToMoment = (m: KeyMoment) => {
    setHighlightLabel(m.label);
    const el = transcriptRef.current;
    if (!el || !m.label) return;
    const idx = transcript.toLowerCase().indexOf(m.label.toLowerCase().slice(0, 40));
    if (idx >= 0) {
      el.focus();
      el.setSelectionRange(idx, Math.min(transcript.length, idx + m.label.length));
      // Approximate scroll
      const ratio = idx / Math.max(1, transcript.length);
      el.scrollTop = ratio * el.scrollHeight;
    }
    setTimeout(() => setHighlightLabel(null), 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-500 p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading transcript…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-brand-600" />
        <h3 className="text-sm font-bold text-stone-900">Interview transcript & AI notes</h3>
      </div>
      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Recording / transcript consent captured
      </label>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-stone-600">Meeting URL (Zoom / Meet / Teams)</label>
        <input
          type="url"
          value={videoLink}
          onChange={(e) => setVideoLink(e.target.value)}
          placeholder="https://meet.google.com/… or Zoom / Teams link"
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !consent || !videoLink.trim()}
            onClick={() => void sendMeetingBot()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold disabled:opacity-50 hover:bg-stone-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            Send meeting bot
          </button>
          {botStatus && (
            <span className="text-[11px] font-medium text-stone-500 capitalize">
              Bot status: {botStatus}
            </span>
          )}
        </div>
        <p className="text-[11px] text-stone-400">
          {botConfigured
            ? 'Meeting bot is ready — paste a Zoom, Meet, or Teams link and send.'
            : 'To auto-join meetings, add your meeting-bot API key in Settings → API Keys.'}
        </p>
      </div>
      <textarea
        ref={transcriptRef}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={6}
        placeholder="Paste Zoom/Meet/Teams transcript or webhook payload text…"
        className={`w-full rounded-xl border px-3 py-2 text-sm ${
          highlightLabel ? 'border-amber-400 ring-2 ring-amber-200' : 'border-stone-200'
        }`}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !transcript.trim() || !consent}
          onClick={() => void saveTranscript()}
          className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold disabled:opacity-50"
        >
          Save transcript
        </button>
        <button
          type="button"
          disabled={busy || !transcript.trim()}
          onClick={() => void runAi()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          AI summarize
        </button>
      </div>
      {keyMoments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Key moments
          </p>
          <ul className="space-y-1">
            {keyMoments.map((m, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => jumpToMoment(m)}
                  className={`w-full text-left text-xs rounded-lg border px-2.5 py-1.5 flex items-center gap-2 hover:bg-brand-50 hover:border-brand-200 transition-colors ${
                    highlightLabel === m.label ? 'border-amber-300 bg-amber-50' : 'border-stone-100'
                  }`}
                >
                  <span className="font-mono text-stone-500 tabular-nums w-12 flex-shrink-0">
                    {formatMs(m.startMs) || m.at || '—'}
                  </span>
                  <span className="text-stone-800 font-medium">{m.label || 'Moment'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {aiSummary && (
        <div className="rounded-xl bg-stone-50 border border-stone-100 p-3 text-sm text-stone-700">
          <p className="text-xs font-bold text-stone-500 uppercase mb-1">Suggested feedback</p>
          {aiSummary}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-stone-500 uppercase">Scorecard suggestions (confirm manually)</p>
            {onApplySuggestions && (
              <button
                type="button"
                onClick={applyToForm}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold hover:bg-amber-100"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Prefill scorecard
              </button>
            )}
          </div>
          {suggestions.map((s, i) => (
            <div key={i} className="text-xs rounded-lg border border-stone-100 px-2 py-1.5 flex justify-between gap-2">
              <span><strong>{s.name}</strong> — {s.rationale}</span>
              <span className="font-bold text-brand-700">{s.suggestedScore}/5</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
