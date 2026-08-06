import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageCircle, Plus, Loader2, Trash2, Save, RefreshCw,
  Copy, Check, ExternalLink, Sparkles, HelpCircle
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { useAuth } from '../context/AuthContext';

const CHAT_TOUR_KEY = 'skillnix_tour_careers_chatbot_v1';
const CHAT_TOUR_STEPS = [
  {
    title: 'Careers Chatbot',
    body: 'Add a helpful FAQ assistant to your public careers page — candidates ask questions, your answers reply automatically.',
  },
  {
    target: '[data-tour="chat-enable"]',
    title: 'Turn it on',
    body: 'Enable the chatbot and set the greeting candidates see first.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="chat-faqs"]',
    title: 'FAQs',
    body: 'Add common questions and answers — no coding. The bot matches candidate questions to these.',
    placement: 'top',
  },
  {
    target: '[data-tour="chat-preview"]',
    title: 'Live preview',
    body: 'See how the chat looks before you save. Use Copy embed only if your website team needs an iframe.',
    placement: 'left',
  },
];

const DEFAULT_GREETING = 'Hi! Ask me about open roles or how to apply.';

function ChatPreview({ enabled, greeting, faqs, orgName }) {
  const sampleFaqs = faqs.filter((f) => f.question.trim()).slice(0, 3);

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-stone-100/80 overflow-hidden shadow-inner min-h-[22rem] flex flex-col">
      <div className="px-3 py-2 flex items-center justify-between bg-stone-200/60 border-b border-stone-200/80">
        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Preview</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          enabled
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-stone-100 text-stone-500 border-stone-200'
        }`}>
          {enabled ? 'On careers page' : 'Off'}
        </span>
      </div>

      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-end relative bg-[linear-gradient(180deg,#f8faf9_0%,#f1f5f4_100%)]">
        {!enabled && (
          <div className="absolute inset-0 bg-white/55 backdrop-blur-[1px] z-10 flex items-center justify-center p-4">
            <p className="text-[12px] font-medium text-stone-500 text-center max-w-[14rem] leading-relaxed">
              Turn on the chatbot to show it on your careers page.
            </p>
          </div>
        )}

        <div className="ml-auto w-full max-w-[17rem] rounded-2xl border border-stone-200 bg-white shadow-lg shadow-stone-900/10 overflow-hidden flex flex-col h-[18rem]">
          <div className="px-3 py-2.5 bg-gradient-to-r from-brand-600 to-teal-600 text-white">
            <p className="text-[12px] font-semibold truncate">{orgName || 'Careers'} assistant</p>
            <p className="text-[10px] text-white/80">Ask about roles & applying</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-stone-50">
            <div className="mr-auto max-w-[90%] rounded-2xl rounded-bl-md bg-white border border-stone-200 px-2.5 py-1.5 text-[11px] text-stone-700 leading-relaxed">
              {greeting?.trim() || DEFAULT_GREETING}
            </div>
            {sampleFaqs.map((f, i) => (
              <div key={i} className="space-y-1">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 text-white px-2.5 py-1.5 text-[11px] leading-relaxed">
                  {f.question}
                </div>
                {f.answer?.trim() ? (
                  <div className="mr-auto max-w-[90%] rounded-2xl rounded-bl-md bg-white border border-stone-200 px-2.5 py-1.5 text-[11px] text-stone-700 leading-relaxed line-clamp-3">
                    {f.answer}
                  </div>
                ) : null}
              </div>
            ))}
            {!sampleFaqs.length && (
              <p className="text-[10px] text-stone-400 text-center pt-6 px-2">
                Add FAQs to see sample answers here.
              </p>
            )}
          </div>
          <div className="p-2 border-t border-stone-100 bg-white flex gap-1.5">
            <div className="flex-1 h-8 rounded-lg bg-stone-100 border border-stone-200" />
            <div className="w-8 h-8 rounded-lg bg-brand-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatbotSettingsPage() {
  const toast = useToast();
  const { organization } = useAuth();
  const [tourOpen, setTourOpen] = usePageTour(CHAT_TOUR_KEY);
  const orgSlug = organization?.slug || organization?.careersSlug || '';
  const orgName = organization?.name || 'Careers';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [greeting, setGreeting] = useState(DEFAULT_GREETING);
  const [faqs, setFaqs] = useState([{ question: '', answer: '' }]);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [removeIdx, setRemoveIdx] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const careersUrl = useMemo(() => {
    if (!orgSlug || typeof window === 'undefined') return '';
    return `${window.location.origin}/careers/${orgSlug}`;
  }, [orgSlug]);

  const embedSnippet = useMemo(() => {
    if (!orgSlug || typeof window === 'undefined') return '';
    return `<iframe src="${window.location.origin}/embed/chatbot/${orgSlug}" style="border:0;width:100%;min-height:420px;height:60vh;max-height:640px" title="Careers chatbot"></iframe>`;
  }, [orgSlug]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/chatbot/admin/settings');
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setEnabled(!!data.data?.enabled);
      setGreeting(data.data?.greeting || DEFAULT_GREETING);
      setFaqs(data.data?.faqs?.length ? data.data.faqs : [{ question: '', answer: '' }]);
    } catch (err) {
      toast.error(err.message || 'Failed to load chatbot settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/chatbot/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          greeting,
          faqs: faqs.filter((f) => f.question.trim() && f.answer.trim())
        })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Chatbot settings saved');
      setFaqs(data.data?.faqs?.length ? data.data.faqs : faqs);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyEmbed = async () => {
    if (!embedSnippet) {
      toast.error('Set your organization slug in Organization settings first');
      return;
    }
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopiedEmbed(true);
      toast.success('Embed code copied — hand to your website team if needed');
      setTimeout(() => setCopiedEmbed(false), 1800);
    } catch {
      toast.error('Could not copy');
    }
  };

  const confirmRemove = async () => {
    if (removeIdx == null) return;
    setConfirmLoading(true);
    try {
      setFaqs((prev) => {
        const next = prev.filter((_, i) => i !== removeIdx);
        return next.length ? next : [{ question: '', answer: '' }];
      });
      setRemoveIdx(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const filledCount = faqs.filter((f) => f.question.trim() && f.answer.trim()).length;

  return (
    <FeatureGate
      feature="careers.chatbot"
      fallback={(
        <UpgradeFeatureFallback
          title="Careers chatbot is a Professional feature"
          description="Upgrade to add an FAQ assistant on your public careers page — no coding required."
        />
      )}
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={MessageCircle}
          title="Careers Chatbot"
          subtitle="Answer candidate questions on your careers page with simple FAQs."
          gradientTitle
        >
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            data-tour="chat-save"
            onClick={save}
            disabled={saving || loading}
            className="btn-primary w-full sm:w-auto"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          Write questions and answers in plain language. Candidates chat on your careers page — you don’t need coding.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-4">
              <div className="card-ats-bordered p-5 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 skeleton-ats rounded-xl" />)}
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="h-80 skeleton-ats rounded-2xl" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-7 min-w-0 space-y-4">
              <section
                data-tour="chat-enable"
                className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-4"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <div className="relative flex items-start justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
                    <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
                    Chatbot settings
                  </h2>
                </div>

                <div className="relative flex items-start gap-3 rounded-2xl border border-stone-200/80 bg-white p-3.5 hover:border-brand-200 transition-colors">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label="Enable chatbot"
                    onClick={() => setEnabled(!enabled)}
                    className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                      enabled ? 'bg-brand-600' : 'bg-stone-300'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow translate-y-0.5 transition ${
                      enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">Show on careers page</p>
                    <p className="text-[12px] text-stone-500 mt-0.5 leading-relaxed">
                      When on, candidates see a chat bubble on your public careers page.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <label className="label-ats" htmlFor="chat-greeting">Greeting message</label>
                  <textarea
                    id="chat-greeting"
                    className="input-ats resize-none"
                    rows={3}
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    placeholder={DEFAULT_GREETING}
                  />
                  <p className="text-[11px] text-stone-400 mt-1.5">First message candidates see when they open the chat.</p>
                </div>

                {careersUrl ? (
                  <a
                    href={careersUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:text-brand-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open careers page
                  </a>
                ) : (
                  <p className="relative text-[12px] text-amber-700">
                    Set your organization slug in Organization settings to get a careers URL.
                  </p>
                )}
              </section>

              <section
                data-tour="chat-faqs"
                className="card-ats-bordered relative overflow-hidden flex flex-col"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <div className="relative px-4 sm:px-5 py-3.5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
                    <HelpCircle className="w-4 h-4 text-brand-600 shrink-0" />
                    FAQs
                    <span className="text-xs font-semibold text-stone-400">{filledCount} ready</span>
                  </h2>
                  <button
                    type="button"
                    className="btn-secondary !text-sm w-full sm:w-auto"
                    onClick={() => setFaqs((prev) => [...prev, { question: '', answer: '' }])}
                  >
                    <Plus className="w-4 h-4" /> Add FAQ
                  </button>
                </div>

                <div className="relative divide-y divide-stone-100">
                  {faqs.length === 0 ? (
                    <EmptyState
                      icon={HelpCircle}
                      tone="brand"
                      message="No FAQs yet"
                      subMessage="Add questions candidates often ask — apply process, locations, benefits."
                      action={
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setFaqs([{ question: '', answer: '' }])}
                        >
                          <Plus className="w-4 h-4" /> Add FAQ
                        </button>
                      }
                    />
                  ) : (
                    faqs.map((faq, idx) => (
                      <div key={idx} className="p-4 sm:px-5 sm:py-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                            FAQ {idx + 1}
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                            onClick={() => setRemoveIdx(idx)}
                            disabled={faqs.length <= 1 && !faq.question && !faq.answer}
                            title="Remove FAQ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                        <input
                          className="input-ats"
                          placeholder="e.g. How do I apply?"
                          value={faq.question}
                          onChange={(e) => setFaqs((prev) => prev.map((f, i) => (i === idx ? { ...f, question: e.target.value } : f)))}
                          aria-label={`FAQ ${idx + 1} question`}
                        />
                        <textarea
                          className="input-ats resize-none"
                          rows={3}
                          placeholder="Write the answer in plain language…"
                          value={faq.answer}
                          onChange={(e) => setFaqs((prev) => prev.map((f, i) => (i === idx ? { ...f, answer: e.target.value } : f)))}
                          aria-label={`FAQ ${idx + 1} answer`}
                        />
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <aside data-tour="chat-preview" className="lg:col-span-5 min-w-0 lg:sticky lg:top-4 space-y-4">
              <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <h2 className="relative flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
                  <MessageCircle className="w-4 h-4 text-brand-600 shrink-0" />
                  Live preview
                </h2>
                <p className="relative text-[12px] text-stone-500 -mt-1">
                  Updates as you edit. Save to publish to the live careers page.
                </p>
                <div className="relative">
                  <ChatPreview
                    enabled={enabled}
                    greeting={greeting}
                    faqs={faqs}
                    orgName={orgName}
                  />
                </div>
              </div>

              <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <h2 className="relative text-[15px] font-bold text-stone-900 tracking-tight">Website embed (optional)</h2>
                <p className="relative text-[12px] text-stone-500 leading-relaxed">
                  Most teams only need the careers page chat. Copy embed only if your website team wants the chatbot on another page.
                </p>
                {orgSlug ? (
                  <button type="button" onClick={copyEmbed} className="btn-secondary w-full relative !justify-center">
                    {copiedEmbed ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copiedEmbed ? 'Copied' : 'Copy for website team'}
                  </button>
                ) : (
                  <p className="relative text-[12px] text-amber-700 leading-relaxed">
                    Set your organization slug first to generate an embed link.
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}

        <ConfirmationModal
          isOpen={removeIdx != null}
          onClose={() => setRemoveIdx(null)}
          onConfirm={confirmRemove}
          title="Remove this FAQ?"
          message="This question and answer will be removed from the list. Save to apply the change on your careers page."
          confirmText="Remove FAQ"
          type="delete"
          isLoading={confirmLoading}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Careers Chatbot" />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={CHAT_TOUR_STEPS}
          storageKey={CHAT_TOUR_KEY}
        />
      </div>
    </FeatureGate>
  );
}
