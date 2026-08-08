'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, Briefcase, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ChatJob {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  suggestedJobs?: ChatJob[];
  needsEmail?: boolean;
  startApply?: boolean;
}

type ApplyStep = null | 'pick' | 'details' | 'resume' | 'done';

interface Props {
  companySlug?: string | null;
  /** When true, hide the floating launcher (used inside embed iframe) */
  embedded?: boolean;
  apiBase?: string;
}

export function CareersChatbot({ companySlug, embedded = false, apiBase = '' }: Props) {
  const [open, setOpen] = useState(embedded);
  const [input, setInput] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content:
        'Hi! I can help you find open roles, walk you through applying, answer FAQs, or connect you with a recruiter. What are you looking for?',
    },
  ]);
  const [applyStep, setApplyStep] = useState<ApplyStep>(null);
  const [applyJobs, setApplyJobs] = useState<ChatJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ChatJob | null>(null);
  const [applyName, setApplyName] = useState('');
  const [applyEmail, setApplyEmail] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [applyResume, setApplyResume] = useState<File | null>(null);
  const [applyError, setApplyError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, applyStep]);

  const beginApply = (jobs: ChatJob[], preferred?: ChatJob) => {
    setApplyJobs(jobs);
    setApplyError('');
    if (preferred) {
      setSelectedJob(preferred);
      setApplyStep('details');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Great — let's apply for ${preferred.title}. I'll need a few details.`,
        },
      ]);
      return;
    }
    setApplyStep('pick');
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content:
          jobs.length > 0
            ? 'Pick a role below and I’ll guide you through the application.'
            : 'Tell me what kind of role you want and I’ll find openings to apply for.',
        suggestedJobs: jobs,
        startApply: true,
      },
    ]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const nextHistory = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextHistory);
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/api/careers/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          companySlug: companySlug || undefined,
          email: email.trim() || undefined,
          history: nextHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error || 'Sorry — I couldn’t respond. Please try again.' },
        ]);
        return;
      }
      const jobs: ChatJob[] = Array.isArray(data.suggestedJobs) ? data.suggestedJobs : [];
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          suggestedJobs: jobs,
          needsEmail: data.needsEmail,
          startApply: data.startApply,
        },
      ]);
      if (data.startApply && jobs.length > 0) {
        setApplyJobs(jobs);
        setApplyStep('pick');
        setApplyError('');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Network error. Please try again in a moment.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const submitApplication = async () => {
    if (!selectedJob) return;
    if (!applyName.trim() || !applyEmail.trim()) {
      setApplyError('Name and email are required');
      return;
    }
    setBusy(true);
    setApplyError('');
    try {
      const form = new FormData();
      form.set('name', applyName.trim());
      form.set('email', applyEmail.trim());
      form.set('phone', applyPhone.trim());
      form.set('jobId', selectedJob.id);
      if (applyResume) form.set('resume', applyResume);
      const res = await fetch(`${apiBase}/api/careers/apply`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Application failed');
      setApplyStep('done');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `You're all set — we received your application for ${selectedJob.title}. Check ${applyEmail.trim()} for a confirmation.`,
        },
      ]);
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : 'Could not submit application');
    } finally {
      setBusy(false);
    }
  };

  const panel = (
    <motion.div
      initial={embedded ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      className={
        embedded
          ? 'w-full h-full rounded-none border-0 bg-white flex flex-col overflow-hidden'
          : 'fixed z-50 w-[min(100vw-1.5rem,380px)] h-[min(70vh,560px)] rounded-2xl border border-stone-200 bg-white shadow-2xl flex flex-col overflow-hidden'
      }
      style={embedded ? undefined : { bottom: '5.5rem', right: '1.25rem' }}
    >
      <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">Careers assistant</p>
          <p className="text-[11px] text-white/70">Find roles · Guided apply · Recruiter handoff</p>
        </div>
        {!embedded && (
          <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-stone-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-stone-900 text-white rounded-br-md'
                  : 'bg-white border border-stone-200 text-stone-800 rounded-bl-md'
              }`}
            >
              <p>{m.content}</p>
              {m.suggestedJobs && m.suggestedJobs.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {m.suggestedJobs.map((j) => (
                    <li key={j.id} className="space-y-1">
                      {embedded ? (
                        <div className="flex items-start gap-2 p-2 rounded-xl bg-stone-50 border border-stone-100 text-stone-800">
                          <Briefcase className="w-3.5 h-3.5 mt-0.5 text-brand-600 flex-shrink-0" />
                          <span>
                            <span className="font-semibold block text-xs">{j.title}</span>
                            <span className="text-[11px] text-stone-500">
                              {j.department} · {j.location}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <Link
                          href={`/careers?job=${j.id}`}
                          className="flex items-start gap-2 p-2 rounded-xl bg-stone-50 border border-stone-100 hover:border-brand-300 text-stone-800"
                        >
                          <Briefcase className="w-3.5 h-3.5 mt-0.5 text-brand-600 flex-shrink-0" />
                          <span>
                            <span className="font-semibold block text-xs">{j.title}</span>
                            <span className="text-[11px] text-stone-500">
                              {j.department} · {j.location}
                            </span>
                          </span>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => beginApply(m.suggestedJobs || [j], j)}
                        className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-stone-900 text-white text-[11px] font-semibold"
                      >
                        Apply with assistant <ArrowRight className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {m.needsEmail && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-2 w-full rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-800"
                />
              )}
            </div>
          </div>
        ))}

        {applyStep === 'pick' && applyJobs.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
            <p className="text-xs font-bold text-stone-600 uppercase">Choose a role</p>
            {applyJobs.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => beginApply(applyJobs, j)}
                className="w-full text-left p-2 rounded-lg border border-stone-100 hover:border-brand-300 text-xs"
              >
                <span className="font-semibold text-stone-900">{j.title}</span>
                <span className="block text-stone-500">{j.location}</span>
              </button>
            ))}
          </div>
        )}

        {applyStep === 'details' && selectedJob && (
          <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
            <p className="text-xs font-bold text-stone-800">Apply: {selectedJob.title}</p>
            <input
              value={applyName}
              onChange={(e) => setApplyName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-xs"
            />
            <input
              type="email"
              value={applyEmail}
              onChange={(e) => setApplyEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-xs"
            />
            <input
              value={applyPhone}
              onChange={(e) => setApplyPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => setApplyStep('resume')}
              disabled={!applyName.trim() || !applyEmail.trim()}
              className="w-full py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {applyStep === 'resume' && selectedJob && (
          <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
            <p className="text-xs font-bold text-stone-800">Resume (PDF/DOC, optional)</p>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setApplyResume(e.target.files?.[0] || null)}
              className="w-full text-xs"
            />
            {applyError && <p className="text-[11px] text-red-600">{applyError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApplyStep('details')}
                className="flex-1 py-2 rounded-lg border border-stone-200 text-xs font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitApplication()}
                className="flex-1 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold disabled:opacity-40"
              >
                {busy ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
          </div>
        )}

        {busy && applyStep === null && (
          <div className="flex items-center gap-2 text-xs text-stone-500 px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {applyStep === null || applyStep === 'done' || applyStep === 'pick' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="p-3 border-t border-stone-200 bg-white flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about roles or say “help me apply”…"
            className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <div className="p-2 border-t border-stone-200 bg-white text-center text-[11px] text-stone-500">
          Guided apply in progress — finish the steps above
        </div>
      )}
    </motion.div>
  );

  if (embedded) {
    return <div className="w-full h-screen">{panel}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-2xl bg-stone-900 text-white shadow-xl shadow-stone-900/30 flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Open careers assistant"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      <AnimatePresence>{open && panel}</AnimatePresence>
    </>
  );
}
