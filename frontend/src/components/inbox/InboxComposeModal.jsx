import React, { useEffect, useMemo, useState } from 'react';
import {
  Mail, Loader2, Send, Phone, MessageSquare, Paperclip, FileText, PenLine, Sparkles, AlertTriangle,
} from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { VARIABLE_OPTIONS } from '../emailTemplates/emailTemplatesConstants';
import { mergeAndPolish } from '../../utils/emailMergePolish';
import { REPLY_CHANNELS, EMPTY_COMPOSE, usedTemplateKeys, composeIsDirty } from './inboxConstants';

const FIELD_META = Object.fromEntries(VARIABLE_OPTIONS.map((v) => [v.key, v]));

function templateTokens(tpl) {
  return usedTemplateKeys(`${tpl?.subject || ''}\n${tpl?.body || ''}`)
    .filter((k) => FIELD_META[k]);
}

export default function InboxComposeModal({
  open,
  sending,
  compose,
  setCompose,
  composeDial,
  composeRecipientReady,
  countryOptions,
  composeFiles = [],
  setComposeFiles,
  templates = [],
  organizationName = '',
  senderName = '',
  onClose,
  onSubmit,
  onSaveDraft,
  savingDraft = false,
}) {
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirty = composeIsDirty(compose, composeFiles);

  useEffect(() => {
    if (!open) setDiscardOpen(false);
  }, [open]);

  const resetAndClose = () => {
    setDiscardOpen(false);
    onClose();
    setCompose({ ...EMPTY_COMPOSE });
    setComposeFiles?.([]);
  };

  const requestClose = () => {
    if (sending || savingDraft) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    resetAndClose();
  };

  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t._id) === String(compose.templateId)) || null,
    [templates, compose.templateId]
  );

  const tokenFields = useMemo(
    () => (compose.mode === 'template' && selectedTemplate ? templateTokens(selectedTemplate) : []),
    [compose.mode, selectedTemplate]
  );

  const vars = compose.templateVars || {};

  useEffect(() => {
    if (!open || compose.mode !== 'template' || !selectedTemplate || compose.templateDirty) return;
    const nextVars = {
      company: organizationName,
      spoc: senderName,
      date: vars.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      ...vars,
    };
    const subject = mergeAndPolish(selectedTemplate.subject, nextVars, { kind: 'subject' });
    const body = mergeAndPolish(selectedTemplate.body, nextVars, { kind: 'body' });
    setCompose((prev) => {
      if (prev.subject === subject && prev.body === body) return prev;
      return { ...prev, subject, body };
    });
  }, [open, compose.mode, selectedTemplate, vars, compose.templateDirty, organizationName, senderName, setCompose]);

  const emailReady = compose.channel !== 'email' || (
    !!String(compose.toAddress || '').trim()
    && !!String(compose.subject || '').trim()
    && !!String(compose.body || '').trim()
  );
  const canSend = !sending && composeRecipientReady && String(compose.body || '').trim() && emailReady;

  const title = compose.mode === 'template'
    ? 'New message · Template'
    : compose.mode === 'custom'
      ? 'New message · Custom'
      : 'New message';

  return (
    <>
      <Modal
        open={open}
        onClose={requestClose}
        title={title}
        description={compose.mode ? 'Org-branded mail from your ATS inbox. To, subject, and body are required.' : 'Choose how you want to write this email.'}
        size="lg"
        closeOnBackdrop={false}
        icon={Mail}
        footer={compose.mode ? (
          <>
            <button type="button" className="btn-secondary" onClick={requestClose} disabled={sending || savingDraft}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onSaveDraft?.()}
              disabled={sending || savingDraft || !dirty}
            >
              {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Save draft
            </button>
            <button
              type="submit"
              form="inbox-compose-form"
              disabled={!canSend}
              className="btn-primary"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </>
        ) : (
          <button type="button" className="btn-secondary" onClick={requestClose}>Close</button>
        )}
      >
        {!compose.mode ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCompose({
                ...compose,
                mode: 'template',
                channel: 'email',
                templateVars: {
                  company: organizationName,
                  spoc: senderName,
                  date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                  ...(compose.templateVars || {}),
                },
              })}
              className="text-left rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-teal-50 p-5 hover:border-brand-400 hover:shadow-md transition-all"
            >
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-teal-600 text-white inline-flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5" />
              </span>
              <p className="text-sm font-bold text-stone-900">Use a template</p>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Pick a hiring template. Position, CTC, and other fields used in it fill in automatically from the candidate.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setCompose({ ...compose, mode: 'custom' })}
              className="text-left rounded-2xl border border-stone-200 bg-white p-5 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <span className="w-10 h-10 rounded-xl bg-stone-900 text-white inline-flex items-center justify-center mb-3">
                <PenLine className="w-5 h-5" />
              </span>
              <p className="text-sm font-bold text-stone-900">Custom mail</p>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Write To, subject, and body yourself. Same branded send as the rest of SkillNix.
              </p>
            </button>
          </div>
        ) : (
          <form id="inbox-compose-form" onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label-ats">Channel</label>
              <PremiumSelect
                icon={Mail}
                value={compose.channel}
                onChange={(v) => setCompose({
                  ...compose,
                  channel: v || 'email',
                  toAddress: '',
                  phone: '',
                  subject: v === 'email' ? compose.subject : '',
                })}
                options={REPLY_CHANNELS}
                placeholder="Choose channel"
              />
            </div>

            {compose.mode === 'template' && compose.channel === 'email' ? (
              <div>
                <label className="label-ats">Template</label>
                <PremiumSelect
                  searchable
                  value={compose.templateId || ''}
                  onChange={(id) => setCompose({
                    ...compose,
                    templateId: id,
                    templateDirty: false,
                  })}
                  options={templates.map((t) => ({
                    value: String(t._id),
                    label: t.name,
                    description: t.category || '',
                  }))}
                  placeholder="Select an email template"
                />
              </div>
            ) : null}

            <div>
              <label className="label-ats" htmlFor="inbox-compose-to">To <span className="text-red-500">*</span></label>
              {compose.channel === 'email' ? (
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <input
                    id="inbox-compose-to"
                    type="email"
                    value={compose.toAddress}
                    onChange={(e) => setCompose({ ...compose, toAddress: e.target.value })}
                    className="input-ats !pl-10"
                    placeholder="candidate@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
              ) : (
                <div className="flex items-stretch gap-2">
                  <div className="w-[8.25rem] flex-shrink-0">
                    <PremiumSelect
                      compact
                      value={compose.countryIso}
                      onChange={(iso) => setCompose({ ...compose, countryIso: iso || 'IN' })}
                      options={countryOptions}
                      placeholder="Code"
                      searchable
                      searchPlaceholder="Search India, +91…"
                    />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    <input
                      id="inbox-compose-to"
                      type="tel"
                      inputMode="numeric"
                      value={compose.phone}
                      onChange={(e) => {
                        let digits = e.target.value.replace(/\D/g, '');
                        if (digits.length > 15) digits = digits.slice(0, 15);
                        setCompose({ ...compose, phone: digits });
                      }}
                      className="input-ats !pl-10"
                      placeholder="Phone number"
                      required
                      autoComplete="tel-national"
                    />
                  </div>
                </div>
              )}
              {compose.matchedCandidate?.name ? (
                <p className="text-[11px] text-brand-700 mt-1.5 font-medium">
                  Matched candidate: {compose.matchedCandidate.name}
                  {compose.matchedCandidate.position ? ` · ${compose.matchedCandidate.position}` : ''}
                </p>
              ) : null}
              {compose.channel !== 'email' && (
                <p className="text-[11px] text-stone-400 mt-1.5 font-medium">
                  Sends to <span className="text-stone-600">{composeDial}{compose.phone || '…'}</span>
                </p>
              )}
            </div>

            {compose.mode === 'template' && tokenFields.length > 0 ? (
              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">Template fields</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {tokenFields.map((key) => {
                    const meta = FIELD_META[key];
                    return (
                      <div key={key} className={key === 'venue' || key === 'applyLink' ? 'sm:col-span-2' : ''}>
                        <label className="label-ats" htmlFor={`tpl-${key}`}>{meta.label}</label>
                        <input
                          id={`tpl-${key}`}
                          value={vars[key] || ''}
                          onChange={(e) => setCompose({
                            ...compose,
                            templateDirty: false,
                            templateVars: { ...vars, [key]: e.target.value },
                          })}
                          className="input-ats"
                          placeholder={meta.example || ''}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {compose.channel === 'email' && (
              <div>
                <label className="label-ats" htmlFor="inbox-compose-subject">Subject <span className="text-red-500">*</span></label>
                <div className="relative">
                  <MessageSquare className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <input
                    id="inbox-compose-subject"
                    value={compose.subject}
                    onChange={(e) => setCompose({ ...compose, subject: e.target.value, templateDirty: true })}
                    className="input-ats !pl-10"
                    placeholder="Subject line"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label-ats" htmlFor="inbox-compose-body">Message <span className="text-red-500">*</span></label>
              <textarea
                id="inbox-compose-body"
                value={compose.body}
                onChange={(e) => setCompose({ ...compose, body: e.target.value, templateDirty: true })}
                className="input-ats resize-none min-h-[9rem]"
                rows={7}
                required
                placeholder="Write your message…"
              />
            </div>

            {compose.channel === 'email' ? (
              <div>
                <label className="label-ats inline-flex items-center gap-2 cursor-pointer">
                  <Paperclip className="w-4 h-4" />
                  Attachments
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const next = [...composeFiles, ...Array.from(e.target.files || [])].slice(0, 5);
                      setComposeFiles?.(next);
                      e.target.value = '';
                    }}
                  />
                </label>
                {composeFiles.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {composeFiles.map((f, i) => (
                      <button
                        key={`${f.name}-${i}`}
                        type="button"
                        className="text-[11px] px-2 py-1 rounded-md bg-brand-50 text-brand-800 border border-brand-100"
                        onClick={() => setComposeFiles?.(composeFiles.filter((_, idx) => idx !== i))}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>
        )}
      </Modal>

      <Modal
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard this mail?"
        description="If you close now, this message will be discarded. Save a draft to keep it in Inbox → Drafts."
        size="sm"
        closeOnBackdrop={false}
        icon={AlertTriangle}
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                await onSaveDraft?.();
                setDiscardOpen(false);
              }}
              disabled={savingDraft}
            >
              {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Save draft
            </button>
            <button type="button" className="btn-primary !bg-amber-600 hover:!bg-amber-700" onClick={resetAndClose}>
              Discard
            </button>
          </>
        )}
      >
        <p className="text-sm text-stone-600">
          Unsent mail is not recoverable unless you save it as a draft first.
        </p>
      </Modal>
    </>
  );
}
