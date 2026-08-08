'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home, User } from 'lucide-react';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useState, useEffect } from 'react';

const routeKeys: Record<string, string> = {
  dashboard: 'dashboard.title',
  candidates: 'dashboard.candidates',
  kanban: 'dashboard.kanban',
  jobs: 'dashboard.jobs',
  new: 'jobEditor.title',
  calendar: 'dashboard.calendar',
  analytics: 'dashboard.analytics',
  reports: 'reports.title',
  inbox: 'dashboard.inbox',
  messages: 'dashboard.messages',
  settings: 'dashboard.settings',
  users: 'dashboard.users',
  'audit-log': 'dashboard.auditLog',
  'talent-pools': 'dashboard.talentPools',
  skills: 'dashboard.skills',
  assessments: 'dashboard.assessments',
  referrals: 'dashboard.referrals',
  esignature: 'dashboard.esignature',
  'background-checks': 'dashboard.backgroundChecks',
  integrations: 'dashboard.integrations',
  company: 'dashboard.company',
  dei: 'dashboard.dei',
  // Premium routes
  premium: 'premium.title',
  search: 'premium.smartSearch.title',
  email: 'premium.emailTemplates.title',
  whatsapp: 'premium.whatsappTemplates.title',
  scoring: 'premium.interviewScoring.title',
  offers: 'premium.offerLetters.title',
  comments: 'premium.teamComments.title',
  resume: 'premium.resumeParser.title',
  jobposting: 'premium.jobPosting.title',
  jobboards: 'premium.jobBoards.title',
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const { t } = useLocale();
  const parts = pathname.split('/').filter(Boolean);
  const segments = parts.slice(1);
  const [dynamicNames, setDynamicNames] = useState<Record<string, string>>({});

  const isDashboardHome = pathname === '/dashboard' || pathname === '/dashboard/';

  // Fetch candidate name when on candidate profile page
  useEffect(() => {
    const isCandidateProfile = segments.length === 2 && segments[0] === 'candidates';
    if (isCandidateProfile) {
      const candidateId = segments[1];
      // Check if it's an ID (not a sub-route)
      if (/^[a-z0-9-]{10,}$/i.test(candidateId)) {
        fetch(`/api/candidates/${candidateId}`, { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.name) {
              setDynamicNames(prev => ({ ...prev, [candidateId]: data.name }));
            }
          })
          .catch(() => {});
      }
    }
  }, [segments]);

  const getLabel = (seg: string, index: number) => {
    // Check if we have a dynamic name for this segment
    if (dynamicNames[seg]) {
      return dynamicNames[seg];
    }
    const key = routeKeys[seg];
    if (key) return t(key);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return t('profile.title');
    if (/^c[a-z0-9]{20,}$/i.test(seg) || /^\d{6,}$/.test(seg)) return t('profile.title');
    return seg;
  };

  return (
    <nav
      className="flex items-center gap-0 overflow-x-auto scrollbar-hide min-w-0 mb-3 rounded-xl border border-stone-200/80 bg-white/80 backdrop-blur-sm px-3 py-2.5 w-fit shadow-[var(--shadow-card)]"
      aria-label="Breadcrumb"
    >
      {isDashboardHome ? (
        <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-stone-900 bg-brand-50/80 text-brand-800 border border-brand-200/50">
          <Home className="w-4 h-4 flex-shrink-0" />
          <span className="hidden xs:inline">{t('dashboard.title')}</span>
        </span>
      ) : (
        <>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 -ml-1 rounded-lg text-sm font-medium text-stone-500 hover:text-brand-600 hover:bg-brand-50/60 transition-all duration-200"
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            <span className="hidden xs:inline">{t('dashboard.title')}</span>
          </Link>
      {segments.map((seg, i) => {
        const href = `/dashboard/${segments.slice(0, i + 1).join('/')}`;
        const label = getLabel(seg, i);
        const isLast = i === segments.length - 1;

        return (
          <span key={seg} className="flex items-center gap-0">
            <ChevronRight className="w-4 h-4 text-stone-300 mx-0.5 flex-shrink-0" />
            {isLast ? (
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold text-stone-900 bg-brand-50/80 text-brand-800 border border-brand-200/50 flex items-center gap-1.5">
                {dynamicNames[seg] && <User className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate max-w-[150px]">{label}</span>
              </span>
            ) : (
              <Link
                href={href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-stone-500 hover:text-brand-600 hover:bg-brand-50/60 transition-all duration-200"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
        </>
      )}
    </nav>
  );
}
