import React from 'react';
import { Mail } from 'lucide-react';
import { WhatsAppIcon } from '../icons/BrandIcons';

/** Default subject/body when freelancers open the OS mail app for a candidate. */
export function freelancerCandidateMailDraft(candidate = {}, extras = {}) {
  const name = String(candidate.name || extras.name || 'there').trim() || 'there';
  const first = name.split(/\s+/)[0] || name;
  const jobHint = String(extras.jobTitle || extras.role || '').trim();
  const jobCode = String(extras.jobCode || '').trim();
  const subject = jobHint
    ? `Opportunity: ${jobHint}${jobCode ? ` (${jobCode})` : ''} — ${name}`
    : `Regarding your profile — ${name}`;
  const body = [
    `Hi ${first},`,
    '',
    jobHint
      ? `I came across your profile and would like to connect about a suitable opportunity (${jobHint}${jobCode ? `, Job ID ${jobCode}` : ''}).`
      : 'I came across your profile and would like to connect regarding a suitable opportunity.',
    '',
    'Please let me know a convenient time to speak, or reply with your updated CV if helpful.',
    '',
    'Looking forward to hearing from you.',
    '',
  ].join('\n');
  return { subject, body };
}

/** Build a mailto: URL for the OS default mail app (Outlook, Mail, Thunderbird). */
export function nativeMailtoHref(email, { subject = '', body = '' } = {}) {
  const addr = String(email || '').trim();
  if (!addr) return '';
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  // URLSearchParams encodes spaces as "+"; mail clients expect %20 in a mailto.
  const qs = params.toString().replace(/\+/g, '%20');
  return `mailto:${addr}${qs ? `?${qs}` : ''}`;
}

export function openNativeMail(email, { subject = '', body = '' } = {}) {
  const href = nativeMailtoHref(email, { subject, body });
  if (!href) return false;
  // Prefer navigating via location so Outlook / Mail / Thunderbird receive a
  // real user-gesture handoff. Fall back to a temporary anchor if needed.
  try {
    window.top.location.href = href;
    return true;
  } catch {
    try {
      window.location.href = href;
      return true;
    } catch {
      try {
        const a = document.createElement('a');
        a.href = href;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return true;
      } catch {
        return false;
      }
    }
  }
}

export function openNativeWhatsApp(phone, text = '') {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length < 7) return;
  const url = `https://wa.me/${cleanPhone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

const BTN = 'h-8 w-8 inline-flex items-center justify-center rounded-lg border shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed';

export default function ContactActionButtons({
  email,
  phone,
  mailTitle,
  waTitle,
  subject,
  body,
  waText,
  stopPropagation = true,
}) {
  const mailto = nativeMailtoHref(email, { subject, body });
  const onWa = (e) => {
    if (stopPropagation) e.stopPropagation();
    openNativeWhatsApp(phone, waText);
  };

  return (
    <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {mailto ? (
        <button
          type="button"
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
            openNativeMail(email, { subject, body });
          }}
          className={`${BTN} border-brand-100 bg-brand-50/80 text-brand-700 hover:bg-brand-100 hover:border-brand-200`}
          title={mailTitle || 'Open mail app'}
          aria-label={mailTitle || 'Email candidate'}
        >
          <Mail size={15} strokeWidth={2} />
        </button>
      ) : (
        <span
          className={`${BTN} border-stone-200 bg-stone-50 text-stone-300 opacity-50 cursor-not-allowed`}
          title="No email on file"
          aria-disabled="true"
        >
          <Mail size={15} strokeWidth={2} />
        </span>
      )}
      <button
        type="button"
        disabled={!String(phone || '').replace(/\D/g, '')}
        onClick={onWa}
        className={`${BTN} border-emerald-200 bg-[#25D366]/12 text-[#128C7E] hover:bg-[#25D366]/20 hover:border-emerald-300`}
        title={phone ? (waTitle || 'Open in WhatsApp') : 'No phone on file'}
      >
        <WhatsAppIcon size={15} />
      </button>
    </div>
  );
}
