import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Sparkles, Bot, Save } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { planHasFeature } from '../config/planFeatures';
import { useAuth } from '../context/AuthContext';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';

export default function InterviewTranscriptPanel({ interview, open, onClose }) {
  const toast = useToast();
  const { organization } = useAuth();
  const allowed = planHasFeature(organization?.plan, 'ai.interviewTranscription');
  const [rawText, setRawText] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [consentCaptured, setConsentCaptured] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const interviewId = interview?._id && !String(interview._id).startsWith('app-') ? interview._id : null;

  useEffect(() => {
    if (!open || !interviewId || !allowed) return;
    (async () => {
      setLoading(true);
      try {
        const res = await authenticatedFetch(`/api/transcripts/interview/${interviewId}`);
        const data = await readApiJson(res);
        if (data.success && data.data) {
          setRawText(data.data.rawText || '');
          setAiSummary(data.data.aiSummary || '');
          setConsentCaptured(!!data.data.consentCaptured);
        } else {
          setRawText('');
          setAiSummary('');
          setConsentCaptured(false);
        }
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, interviewId, allowed, toast]);

  const save = async () => {
    setBusy('save');
    try {
      const res = await authenticatedFetch(`/api/transcripts/interview/${interviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, source: 'manual', consentCaptured })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Transcript saved');
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const summarize = async () => {
    setBusy('sum');
    try {
      const ok = await save();
      if (!ok) return;
      setBusy('sum');
      const res = await authenticatedFetch(`/api/transcripts/interview/${interviewId}/summarize`, { method: 'POST' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setAiSummary(data.data.aiSummary || '');
      toast.success('AI summary ready');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const launchBot = async () => {
    setBusy('bot');
    try {
      const res = await authenticatedFetch(`/api/transcripts/interview/${interviewId}/meeting-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingUrl: meetingUrl || interview?.meetingLink || '', consentCaptured })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setRawText(data.data.rawText || '');
      toast.success(data.message || 'Meeting bot requested');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Interview AI transcript"
      description="Paste notes or launch a BYOK meeting bot, then summarize with your AI key."
      size="lg"
      footer={
        allowed && interviewId ? (
          <>
            <button type="button" className="btn-secondary w-full sm:w-auto" disabled={!!busy} onClick={save}>
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
            <button type="button" className="btn-primary w-full sm:w-auto" disabled={!!busy || !rawText.trim()} onClick={summarize}>
              {busy === 'sum' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Summarize
            </button>
          </>
        ) : null
      }
    >
      {!allowed ? (
        <EmptyState
          icon={Sparkles}
          tone="amber"
          compact
          message="Enterprise feature"
          subMessage="Interview transcription requires an Enterprise plan with AI transcription enabled."
        />
      ) : !interviewId ? (
        <EmptyState
          icon={FileText}
          tone="amber"
          compact
          message="Formal interview required"
          subMessage="Transcripts work on interview records, not application-only schedules."
        />
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-stone-400" /></div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-100 bg-stone-50/60 cursor-pointer">
            <input
              type="checkbox"
              checked={consentCaptured}
              onChange={(e) => setConsentCaptured(e.target.checked)}
              className="mt-0.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block text-sm font-semibold text-stone-900">Consent captured</span>
              <span className="block text-xs text-stone-500 mt-0.5">Recording / transcript consent confirmed with participants</span>
            </span>
          </label>

          <div>
            <label className="label-ats">Transcript / notes</label>
            <textarea
              className="input-ats resize-none font-mono text-xs"
              rows={8}
              placeholder="Paste transcript or notes…"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
          </div>

          {aiSummary ? (
            <div className="rounded-xl bg-brand-50/60 border border-brand-100 p-3 min-w-0">
              <div className="text-xs font-bold text-brand-800 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> AI summary
              </div>
              <p className="text-sm text-stone-700 whitespace-pre-wrap break-words">{aiSummary}</p>
            </div>
          ) : null}

          <div>
            <label className="label-ats">Meeting URL for bot</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="input-ats flex-1 min-w-0"
                placeholder={interview?.meetingLink || 'https://meet.google.com/…'}
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
              />
              <button type="button" className="btn-secondary w-full sm:w-auto" disabled={!!busy} onClick={launchBot}>
                {busy === 'bot' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />} Meeting bot
              </button>
            </div>
          </div>

          <p className="text-[11px] text-stone-400 flex items-start gap-1.5">
            <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Uses your org AI adapter — no SkillNix-hosted model keys.
          </p>
        </div>
      )}
    </Modal>
  );
}
