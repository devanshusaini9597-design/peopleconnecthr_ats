/**
 * Shared enterprise chrome for public subscribe / unsubscribe pages.
 * Footer layout mirrors branded marketing email footers (logo pill, reason,
 * social, Website | Privacy policy | Help, address, copyright).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Linkedin,
  Facebook,
  Instagram,
  Youtube,
  ArrowLeft,
} from 'lucide-react';

const LOGO_SRC = '/skillnix-logo.png?v=3';
export const COMPANY_SITE = 'https://skillnixrecruitment.com';
const COMPANY_ADDRESS =
  'Skillnix Recruitment Services Private Limited · Gurudwara Gali near Railway crossing, Shyampur, Rishikesh';
const FOOTER_REASON =
  'You are viewing this page because you manage job and career email preferences with Skillnix Recruitment.';

const SOCIAL_LINKS = [
  {
    key: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/skillnix-recruitment-services',
    Icon: Linkedin,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/skillnixrecruitment',
    Icon: Facebook,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/skillnixrecruitment',
    Icon: Instagram,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@skillnixrecruitment',
    Icon: Youtube,
  },
].filter((s) => s.href);

export default function PublicMarketingShell({
  children,
  eyebrow = '',
  title,
  subtitle,
  backTo = null,
  backLabel = 'Back',
}) {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen relative flex flex-col overflow-hidden bg-[#f3f4f6]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 90% 55% at 50% -15%, rgba(15,118,110,0.07), transparent 55%), linear-gradient(180deg, #eef1f4 0%, #f7f8fa 40%, #f3f4f6 100%)',
        }}
        aria-hidden
      />

      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[560px]">
          {backTo ? (
            <div className="mb-4">
              <Link
                to={backTo}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-teal-900 no-underline transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.25} />
                {backLabel}
              </Link>
            </div>
          ) : null}

          <div className="bg-white border border-[#e5e7eb] overflow-hidden rounded-lg shadow-[0_28px_64px_-32px_rgba(15,23,42,0.28)]">
            <div className="h-1 bg-teal-700" aria-hidden />
            <div className="relative bg-[#111827] px-7 sm:px-10 pt-8 pb-7 overflow-hidden">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'radial-gradient(ellipse 70% 80% at 100% 0%, rgba(20,184,166,0.16), transparent 50%)',
                }}
                aria-hidden
              />
              <img
                src={LOGO_SRC}
                alt="Skillnix"
                className="relative h-9 w-auto max-w-[168px] object-contain"
              />
              {eyebrow ? (
                <p className="relative mt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300/95">
                  {eyebrow}
                </p>
              ) : null}
              {title ? (
                <h1 className="relative mt-2 text-[22px] sm:text-[26px] font-semibold tracking-tight text-white leading-snug">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="relative mt-3 text-[14px] text-slate-300 leading-relaxed max-w-md">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="px-7 sm:px-10 py-7 sm:py-8">{children}</div>
          </div>

          {/* Email-matched footer (outside card) */}
          <footer className="mt-8 px-2 sm:px-6 pb-10 text-center">
            <a
              href={COMPANY_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded bg-[#111827] px-[22px] py-3.5 no-underline mb-4"
            >
              <img
                src={LOGO_SRC}
                alt="Skillnix Recruitment"
                className="h-7 w-auto max-w-[148px] object-contain"
              />
            </a>

            <p className="mx-auto max-w-[460px] text-[13px] leading-relaxed text-[#6b7280]">
              {FOOTER_REASON}
            </p>

            <div className="mt-4 flex items-center justify-center gap-2.5">
              {SOCIAL_LINKS.map(({ key, label, href, Icon }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#6b7280] hover:text-teal-800 hover:border-teal-700/40 transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                </a>
              ))}
            </div>

            <p className="mt-[18px] text-[13px] leading-relaxed">
              <a
                href={COMPANY_SITE}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 font-medium underline underline-offset-2 hover:text-teal-900"
              >
                Website
              </a>
              <span className="text-[#c5cdd6]">&nbsp;|&nbsp;</span>
              <a
                href={`${COMPANY_SITE}/privacy`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 font-medium underline underline-offset-2 hover:text-teal-900"
              >
                Privacy policy
              </a>
              <span className="text-[#c5cdd6]">&nbsp;|&nbsp;</span>
              <a
                href={`${COMPANY_SITE}/contact`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 font-medium underline underline-offset-2 hover:text-teal-900"
              >
                Help
              </a>
            </p>

            <p className="mt-3.5 text-[12px] leading-relaxed text-[#9ca3af] max-w-[460px] mx-auto">
              {COMPANY_ADDRESS}
            </p>
            <p className="mt-4 text-[12px] leading-relaxed text-[#9ca3af]">
              © {year} Skillnix Recruitment
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

export function FieldLabel({ children, required }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 mb-1.5">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : null}
    </label>
  );
}

export const fieldClassName =
  'w-full px-3.5 py-2.5 border border-stone-200 bg-white text-sm text-stone-900 rounded-lg outline-none transition-shadow placeholder:text-stone-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15';

/** Primary enterprise CTA */
export const primaryBtnClassName =
  'w-full py-3.5 px-4 bg-teal-800 text-white rounded-lg font-semibold text-sm tracking-tight hover:bg-teal-900 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_20px_-10px_rgba(15,118,110,0.55)]';

/** Dark premium CTA (e.g. Visit Skillnix) */
export const premiumBtnClassName =
  'w-full py-3.5 px-4 bg-[#0b1220] text-white rounded-lg font-semibold text-sm tracking-tight hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_10px_24px_-12px_rgba(15,23,42,0.55)]';

export const secondaryBtnClassName =
  'w-full py-3.5 px-4 bg-white text-slate-800 border border-stone-200 rounded-lg font-semibold text-sm tracking-tight hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors';

export const dangerBtnClassName =
  'w-full py-3.5 px-4 bg-slate-900 text-white rounded-lg font-semibold text-sm tracking-tight hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors';
