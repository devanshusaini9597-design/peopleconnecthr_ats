import React, { useState } from 'react';
import {
  MapPin, Briefcase, IndianRupee, Building2, Clock, Copy, Check, FileText, User, Layers, Users,
} from 'lucide-react';
import {
  employmentLabel, htmlToList, looksLikeHtml, stripHtml,
  composeJobDescriptionText, splitLocations, STATUS_STYLES, DOT_STYLES,
} from './jobsConstants';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

function hasJdText(value) {
  return Boolean(stripHtml(value || '').replace(/\s+/g, ' ').trim());
}

function titleCase(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw !== raw.toUpperCase() || !/[A-Z]/.test(raw)) return raw;
  return raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayEmployment(type) {
  const label = employmentLabel(type);
  if (!label) return '';
  return titleCase(label.replace(/_/g, ' '));
}

function Section({ id, title, children, active }) {
  return (
    <section
      data-preview={id}
      className={`space-y-2.5 rounded-xl px-1 py-1 -mx-1 transition-colors ${active ? 'bg-brand-50/60' : ''}`}
    >
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-stone-900 tracking-tight">
        <span className="w-1 h-3.5 rounded-full bg-gradient-to-b from-brand-500 to-teal-500 shrink-0" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Rich({ html }) {
  if (!hasJdText(html)) return null;
  if (!looksLikeHtml(html)) {
    return <p className="text-[15px] text-stone-600 leading-relaxed whitespace-pre-wrap">{html}</p>;
  }
  return (
    <div
      className="text-[15px] text-stone-600 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_strong]:font-semibold [&_strong]:text-stone-800 [&_p]:mb-2 [&_a]:text-brand-700 [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

function BulletList({ text }) {
  const items = htmlToList(text);
  if (!items.length) return null;
  if (looksLikeHtml(text) && hasJdText(text)) return <Rich html={text} />;
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-stone-600 leading-relaxed">
      {items.map((item, idx) => <li key={`${idx}-${item.slice(0, 24)}`}>{item}</li>)}
    </ul>
  );
}

const FACT_TONES = {
  client: 'from-brand-500 to-teal-600 shadow-brand-500/20',
  industry: 'from-sky-500 to-brand-600 shadow-sky-500/20',
  locations: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
  experience: 'from-amber-500 to-orange-500 shadow-amber-500/20',
  compensation: 'from-teal-500 to-brand-700 shadow-teal-500/20',
  employment: 'from-violet-500 to-brand-600 shadow-violet-500/20',
};

function Fact({ icon: Icon, label, value, tone = 'client' }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className={`mt-0.5 w-9 h-9 rounded-xl bg-gradient-to-br ${FACT_TONES[tone] || FACT_TONES.client} text-white flex items-center justify-center shrink-0 shadow-sm`}>
        <Icon size={15} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-stone-400">{label}</p>
        <p className="text-sm font-medium text-stone-800 leading-snug">{value}</p>
      </div>
    </div>
  );
}

export default function JobJdPreview({
  form,
  activeSection = '',
  heading = 'Live preview',
  status = '',
  openings,
  hiringManager = '',
  embedded = false,
}) {
  const [copied, setCopied] = useState(false);
  const title = titleCase(String(form.role || '').trim()) || 'Untitled role';
  const typeLabel = displayEmployment(form.employmentType);
  const locations = splitLocations(form.locations, form.location).map(titleCase);
  const locationLine = locations.join(', ');
  const client = titleCase(form.clientName);
  const industry = titleCase(form.industry);
  const grade = titleCase(form.grade);
  const experience = String(form.experience || '').trim();
  const ctc = String(form.ctc || '').trim();
  const hasFacts = Boolean(client || industry || ctc || experience || locationLine || typeLabel);
  const hasSummary = hasJdText(form.summary);
  const hasResponsibilities = htmlToList(form.responsibilitiesText).length > 0;
  const hasRequirements = htmlToList(form.requirementsText).length > 0;
  const hasPreferred = hasJdText(form.preferredProfile);
  const hasSpocName = hasJdText(form.spocName);
  const hasSpocContact = hasJdText(form.spocContact);
  const hasSpocEmail = hasJdText(form.spocEmail);
  const hasInternalNotes = hasJdText(form.internalNotes);
  const hasNotes = hasSpocName || hasSpocContact || hasSpocEmail || hasInternalNotes;
  const hasBody = hasSummary || hasResponsibilities || hasRequirements || hasPreferred;
  const isEmptyPreview = !String(form.role || '').trim() && !hasFacts && !hasBody && !hasNotes;
  const pad = embedded ? 'px-6 sm:px-8' : 'px-5 sm:px-7';

  const copyJd = async () => {
    const text = composeJobDescriptionText(form);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className={embedded
      ? 'bg-white overflow-hidden flex flex-col'
      : 'rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col min-h-full'}
    >
      <div className={`${pad} pt-6 pb-5 border-b border-stone-100`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-stone-400 tracking-wide">
              {[heading, form.jobCode].filter(Boolean).join(' · ')}
            </p>
            <h2 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-tight mt-1 leading-snug">
              {title}
            </h2>
            {grade ? (
              <p className="text-sm text-stone-500 mt-1">{grade}</p>
            ) : null}
            {(status || openings || hiringManager || form.priority === 'urgent') ? (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {form.priority === 'urgent' ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-white bg-red-600 border border-red-700 px-2.5 py-1 rounded-full shadow-sm">
                    Urgent hiring
                  </span>
                ) : null}
                {status ? (
                  <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES.Open}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${DOT_STYLES[status] || DOT_STYLES.Open}`} />
                    {status}
                  </span>
                ) : null}
                {openings ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-700 bg-gradient-to-br from-brand-50 to-teal-50 border border-brand-200/70 px-2.5 py-1 rounded-full">
                    <Users size={12} className="text-brand-600" />
                    {openings} opening{Number(openings) === 1 ? '' : 's'}
                  </span>
                ) : null}
                {hiringManager ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-teal-800 bg-gradient-to-br from-teal-50 to-brand-50 border border-teal-200/70 px-2.5 py-1 rounded-full">
                    <User size={12} className="text-teal-600" />
                    {hiringManager}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={copyJd}
            disabled={isEmptyPreview}
            className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-brand-200/80 bg-gradient-to-br from-brand-50 to-teal-50 text-[12px] font-medium text-brand-700 hover:border-brand-300 hover:from-brand-100 hover:to-teal-100 transition-colors disabled:opacity-40"
            title="Copy JD as text"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy JD'}
          </button>
        </div>
      </div>

      {isEmptyPreview ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-600 text-white flex items-center justify-center mb-3 shadow-md shadow-brand-500/25">
            <FileText size={20} />
          </div>
          <p className="text-sm font-semibold text-stone-800">No job description yet</p>
          <p className="text-[13px] text-stone-500 mt-1.5 max-w-xs leading-relaxed">
            Add a summary, responsibilities, and requirements. The preview will appear here.
          </p>
        </div>
      ) : (
        <>
          {hasFacts ? (
            <div
              data-preview="header"
              className={`${pad} py-5 border-b border-brand-100/80 grid sm:grid-cols-2 gap-x-8 gap-y-4 ${activeSection === 'header' ? 'bg-brand-50/50' : 'bg-gradient-to-br from-brand-50/40 via-white to-teal-50/30'}`}
            >
              <Fact icon={Building2} label="Client" value={client} tone="client" />
              <Fact icon={Briefcase} label="Industry" value={industry} tone="industry" />
              <Fact icon={MapPin} label="Locations" value={locationLine} tone="locations" />
              <Fact icon={Clock} label="Experience" value={experience} tone="experience" />
              <Fact icon={IndianRupee} label="Compensation" value={ctc} tone="compensation" />
              <Fact icon={Layers} label="Employment" value={typeLabel} tone="employment" />
            </div>
          ) : null}

          {hasBody || hasNotes ? (
            <div className={`${pad} py-6 space-y-7`}>
              {hasSummary ? (
                <Section id="summary" title="About the role" active={activeSection === 'summary'}>
                  <Rich html={form.summary} />
                </Section>
              ) : null}
              {hasResponsibilities ? (
                <Section id="responsibilities" title="Responsibilities" active={activeSection === 'responsibilities'}>
                  <BulletList text={form.responsibilitiesText} />
                </Section>
              ) : null}
              {hasRequirements ? (
                <Section id="requirements" title="Requirements" active={activeSection === 'requirements'}>
                  <BulletList text={form.requirementsText} />
                </Section>
              ) : null}
              {hasPreferred ? (
                <Section id="preferred" title="Preferred profile" active={activeSection === 'preferred'}>
                  <Rich html={form.preferredProfile} />
                </Section>
              ) : null}
              {hasNotes ? (
                <Section id="notes" title="Internal notes" active={activeSection === 'notes'}>
                  <div className="rounded-xl border border-brand-200/70 bg-gradient-to-br from-brand-50/50 via-white to-teal-50/40 px-4 py-3.5 text-sm text-stone-700 space-y-1.5">
                    {hasSpocName ? (
                      <p><span className="font-medium text-stone-500">SPOC</span> · {form.spocName}</p>
                    ) : null}
                    {hasSpocContact ? (
                      <p><span className="font-medium text-stone-500">Phone</span> · {form.spocContact}</p>
                    ) : null}
                    {hasSpocEmail ? (
                      <p><span className="font-medium text-stone-500">Email</span> · {form.spocEmail}</p>
                    ) : null}
                    {hasInternalNotes ? (
                      <p className={`whitespace-pre-wrap ${hasSpocName || hasSpocContact || hasSpocEmail ? 'pt-1 border-t border-stone-200/80' : ''}`}>{form.internalNotes}</p>
                    ) : null}
                  </div>
                </Section>
              ) : null}
            </div>
          ) : !embedded ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-6">
              <p className="text-sm font-semibold text-stone-800">Details only</p>
              <p className="text-[13px] text-stone-500 mt-1 max-w-xs leading-relaxed">
                Job summary, responsibilities, and requirements will show here once they are added.
              </p>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
