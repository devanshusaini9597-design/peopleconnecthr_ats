import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase, Phone, XCircle, UserCheck, FileCheck, Sparkles, Megaphone,
  ClipboardList, Search, RotateCcw, Eye,
} from 'lucide-react';
import PremiumSelect from '../../ui/PremiumSelect';
import { TIME_SELECT_OPTIONS } from '../atsConstants';
import { mergeAndPolish } from '../../../utils/emailMergePolish';
import { buildQuickDraftHtml } from './quickEmailDraft';
import EmailPreviewModal from './EmailPreviewModal';

const CATEGORY_UI = {
  hiring: { label: 'Hiring', Icon: Briefcase },
  interview: { label: 'Interview', Icon: Phone },
  offer: { label: 'Offer', Icon: FileCheck },
  assessment: { label: 'Assessment', Icon: ClipboardList },
  rejection: { label: 'Rejection', Icon: XCircle },
  onboarding: { label: 'Onboarding', Icon: UserCheck },
  document: { label: 'Documents', Icon: FileCheck },
  marketing: { label: 'Marketing', Icon: Megaphone },
  custom: { label: 'Custom', Icon: Sparkles },
};

const MARKETING_CATEGORIES = new Set(['marketing']);

const FIELD_LABELS = {
  candidateName: 'Candidate name',
  position: 'Position / role',
  company: 'Organization',
  orgName: 'Organization',
  jobEmployer: 'Employer (public)',
  ctc: 'CTC / salary',
  experience: 'Experience',
  location: 'Location',
  date: 'Date',
  time: 'Time',
  venue: 'Venue / link',
  spoc: 'SPOC',
  subscribeLink: 'Subscribe URL',
  jobTitle: 'Job title',
  jobCode: 'Job ID',
  applyLink: 'Apply link',
  jobLocation: 'Job location',
  jobDepartment: 'Job department',
  jobClient: 'Employer (public)',
  jobExperience: 'Job experience',
  jobSummary: 'Short summary',
};

function applyTemplateVars(text, vars, { kind = 'body', isBulk = false } = {}) {
  return mergeAndPolish(text, vars, {
    kind,
    preserveTokens: isBulk ? ['candidateName'] : [],
  });
}

export default function EmailTemplateMode({
  emailTemplates,
  templatesLoading = false,
  selectedTemplate,
  selectEmailTemplate,
  setSelectedTemplate,
  templateVars,
  setTemplateVars,
  orgName = '',
  emailChannel = 'transactional',
  templateDraftSubject = '',
  setTemplateDraftSubject,
  templateDraftBody = '',
  setTemplateDraftBody,
  templateDraftDirty = false,
  setTemplateDraftDirty,
  isBulk = false,
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');

  const brand = useMemo(
    () => orgName || String(templateVars?.company || '').trim() || 'Your company',
    [orgName, templateVars?.company]
  );

  const orgLogoUrl = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem('orgData') || '{}');
      return String(data?.logo || '').trim();
    } catch {
      return '';
    }
  }, []);

  const orgBrandColor = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem('orgData') || '{}');
      return data?.atsSettings?.brandColor || '#0f766e';
    } catch {
      return '#0f766e';
    }
  }, []);

  const categoryOptions = useMemo(() => {
    const cats = new Set(emailTemplates.map((t) => t.category).filter(Boolean));
    return [
      { value: 'all', label: 'All categories' },
      ...[...cats].sort().map((c) => ({
        value: c,
        label: CATEGORY_UI[c]?.label || c,
      })),
    ];
  }, [emailTemplates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return emailTemplates.filter((t) => {
      const isMarketingTpl = MARKETING_CATEGORIES.has(t.category);
      if (emailChannel === 'marketing' && !isMarketingTpl) return false;
      if (emailChannel === 'transactional' && isMarketingTpl) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        String(t.name || '').toLowerCase().includes(q) ||
        String(t.subject || '').toLowerCase().includes(q)
      );
    });
  }, [emailTemplates, search, categoryFilter, emailChannel]);

  // Keep draft in sync with template + details until the user edits on the spot.
  useEffect(() => {
    if (!selectedTemplate || !setTemplateDraftSubject || !setTemplateDraftBody) return;
    if (templateDraftDirty) return;
    setTemplateDraftSubject(applyTemplateVars(selectedTemplate.subject, templateVars, { kind: 'subject', isBulk }));
    setTemplateDraftBody(applyTemplateVars(selectedTemplate.body, templateVars, { kind: 'body', isBulk }));
  }, [
    selectedTemplate,
    templateVars,
    templateDraftDirty,
    isBulk,
    setTemplateDraftSubject,
    setTemplateDraftBody,
  ]);

  const resetDraftFromTemplate = () => {
    if (!selectedTemplate) return;
    setTemplateDraftDirty?.(false);
    setTemplateDraftSubject?.(applyTemplateVars(selectedTemplate.subject, templateVars, { kind: 'subject', isBulk }));
    setTemplateDraftBody?.(applyTemplateVars(selectedTemplate.body, templateVars, { kind: 'body', isBulk }));
  };

  const onSubjectChange = (value) => {
    setTemplateDraftDirty?.(true);
    setTemplateDraftSubject?.(value);
  };

  const onBodyChange = (value) => {
    setTemplateDraftDirty?.(true);
    setTemplateDraftBody?.(value);
  };

  const openPreview = () => {
    const subject = (templateDraftSubject || '').trim() || 'Message';
    const html = buildQuickDraftHtml({
      subject,
      body: templateDraftBody || '',
      brand,
      logoUrl: orgLogoUrl,
      brandColor: orgBrandColor,
      sampleName: isBulk ? 'Candidate' : (templateVars?.candidateName || ''),
    });
    setPreviewSubject(subject);
    setPreviewHtml(html);
    setShowPreview(true);
  };

  if (!selectedTemplate) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Select a template</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {templatesLoading
                ? 'Loading template library…'
                : `${filtered.length} available for ${emailChannel === 'marketing' ? 'campaign' : 'transactional'} delivery`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates…"
                className="input-ats input-ats-icon w-full !py-2"
                disabled={templatesLoading}
              />
            </div>
            <div className="w-full sm:w-40 shrink-0">
              <PremiumSelect
                compact
                value={categoryFilter}
                onChange={(v) => setCategoryFilter(v || 'all')}
                options={categoryOptions}
                placeholder="Category"
                disabled={templatesLoading}
              />
            </div>
          </div>
        </div>

        {templatesLoading ? (
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-10 text-center space-y-3">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="text-sm font-medium text-stone-700">Loading template library</p>
            <p className="text-xs text-stone-500">Preparing approved message templates for your organization.</p>
          </div>
        ) : emailTemplates.length === 0 ? (
          <p className="text-sm text-stone-500 py-8 text-center rounded-xl border border-dashed border-stone-200">
            No templates available. Contact your administrator if the library should already be seeded.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-stone-500 py-8 text-center rounded-xl border border-dashed border-stone-200">
            No templates match this filter. Try another category or delivery channel.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-white">
            {filtered.map((t) => {
              const meta = CATEGORY_UI[t.category] || CATEGORY_UI.custom;
              const Icon = meta.Icon;
              return (
                <li key={t._id}>
                  <button
                    type="button"
                    onClick={() => selectEmailTemplate(t)}
                    className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-stone-50 transition"
                  >
                    <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-stone-900">{t.name}</span>
                        <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{t.subject}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-stone-400 font-medium">Selected template</p>
          <h3 className="text-sm font-semibold text-stone-900 mt-0.5">{selectedTemplate.name}</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Edits apply to this send only; the saved template library is unchanged.
            {isBulk
              ? ' Keep {{candidateName}} in the text so each recipient is addressed individually.'
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedTemplate(null);
            setTemplateDraftDirty?.(false);
            setTemplateDraftSubject?.('');
            setTemplateDraftBody?.('');
          }}
          className="text-sm font-medium text-brand-700 hover:text-brand-800 shrink-0"
        >
          Change
        </button>
      </div>

      {selectedTemplate.variables?.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-stone-800">Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedTemplate.variables.filter((v) => v !== 'subscribeLink').map((v) => (
              <div key={v}>
                <label className="label-ats mb-1.5 block">{FIELD_LABELS[v] || v}</label>
                {v === 'candidateName' && isBulk ? (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-2.5">
                    <p className="text-sm font-medium text-stone-800">Auto — each person&apos;s name</p>
                    <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                      No need to type anything. The mail uses each recipient&apos;s own name automatically.
                    </p>
                  </div>
                ) : v === 'time' ? (
                  <PremiumSelect
                    compact
                    searchable
                    allowClear
                    placeholder="Select time"
                    options={TIME_SELECT_OPTIONS}
                    value={(() => {
                      const t = templateVars[v];
                      if (!t) return '';
                      const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
                      if (!m) return '';
                      let h = parseInt(m[1], 10);
                      const ampm = m[3].toUpperCase();
                      if (ampm === 'PM' && h !== 12) h += 12;
                      if (ampm === 'AM' && h === 12) h = 0;
                      return `${String(h).padStart(2, '0')}:${m[2]}`;
                    })()}
                    onChange={(val) => {
                      if (val) {
                        const [h, m] = val.split(':');
                        const hr = parseInt(h, 10);
                        const ampm = hr >= 12 ? 'PM' : 'AM';
                        const hr12 = hr % 12 || 12;
                        setTemplateVars((prev) => ({ ...prev, [v]: `${hr12}:${m} ${ampm}` }));
                      } else {
                        setTemplateVars((prev) => ({ ...prev, [v]: '' }));
                      }
                    }}
                  />
                ) : (
                  <input
                    type={v === 'date' ? 'date' : 'text'}
                    value={templateVars[v] || ''}
                    onChange={(e) => setTemplateVars((prev) => ({ ...prev, [v]: e.target.value }))}
                    placeholder={FIELD_LABELS[v] || v}
                    className="input-ats w-full"
                    readOnly={v === 'company' || v === 'orgName' || v === 'jobEmployer' || v === 'applyLink'}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-stone-800">Message</h4>
          {templateDraftDirty && (
            <button
              type="button"
              onClick={resetDraftFromTemplate}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              <RotateCcw size={12} />
              Reset to template
            </button>
          )}
        </div>

        <div>
          <label className="label-ats mb-1.5 block">Subject</label>
          <input
            type="text"
            value={templateDraftSubject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Email subject"
            className="input-ats w-full"
          />
        </div>

        <div>
          <label className="label-ats mb-1.5 block">Body</label>
          <textarea
            value={templateDraftBody}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Email body"
            rows={8}
            className="input-ats w-full resize-y min-h-[10rem] !h-auto py-2.5 leading-relaxed"
          />
        </div>

        <div className="flex justify-between text-[11px] text-stone-400 px-0.5">
          <span>{brand}</span>
          <span>{emailChannel === 'marketing' ? 'Campaign' : 'Direct'}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={openPreview}
        className="btn-secondary !text-sm"
        disabled={!(templateDraftBody || '').trim()}
      >
        <Eye size={14} /> Preview how it will look
      </button>

      <EmailPreviewModal
        open={Boolean(showPreview && previewHtml)}
        onClose={() => setShowPreview(false)}
        subject={previewSubject}
        html={previewHtml}
        brand={brand}
      />
    </section>
  );
}
