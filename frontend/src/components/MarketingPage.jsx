import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Shield, Sparkles, Plug, Building2, CheckCircle2, Menu, X } from 'lucide-react';

const PAGES = {
  pricing: {
    title: 'Pricing that scales with hiring',
    subtitle: 'Start free. Upgrade when your team is ready for enterprise controls.',
    body: (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-10">
        {[
          { name: 'Free Trial', price: 'Free', items: ['21 days', '5 users (roles the owner assigns)', '15 job postings', '2,000 emails', 'No backup'] },
          { name: 'Starter', price: '₹2,499', items: ['Monthly', '3 users (owner plus 2)', '30 job postings', '6,000 emails', 'No backup', 'No old data import'] },
          { name: 'Premium', price: '₹8,499', items: ['Monthly, or 25% off yearly', '10 users (owner plus 9)', '50 job postings', '10,000 emails', 'Backup included', 'Old data import'] },
          { name: 'Custom', price: 'Custom', items: ['Users, jobs, and mail quoted with sales', 'Backup and import as scoped', 'Dedicated commercial terms'] }
        ].map((p) => (
          <div key={p.name} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xl shadow-stone-200/50">
            <h3 className="text-lg font-bold text-stone-900">{p.name}</h3>
            <p className="text-3xl font-bold text-brand-700 mt-2">{p.price}{p.price.startsWith('₹') ? <span className="text-sm font-medium text-stone-400">/month + 18% GST</span> : null}</p>
            <ul className="mt-4 space-y-2">
              {p.items.map((i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 mt-0.5" /> {i}
                </li>
              ))}
            </ul>
            <Link to="/register" className="btn-primary w-full mt-6 justify-center">Get started</Link>
          </div>
        ))}
      </div>
    )
  },
  features: {
    title: 'Everything modern recruiting teams need',
    subtitle: 'Jobs, candidates, interviews, a careers page, and mail — limited by the plan on the workspace.',
    body: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
        {[
          ['Pipeline', 'Stages on each job. Custom names on Professional and Enterprise.'],
          ['Careers page', 'Public openings candidates can search and apply to.'],
          ['Plan mail', 'Included. Replies go to your address. Usage counts this month.'],
          ['Reports', 'Hiring and email delivery for this organization.'],
          ['Billing', 'Live seats, jobs, candidates, and emails left on the plan.'],
          ['Enterprise domain', 'Send as your domain, and host the careers site on your hostname.']
        ].map(([t, d]) => (
          <div key={t} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-lg shadow-stone-200/40">
            <h3 className="font-bold text-stone-900">{t}</h3>
            <p className="text-sm text-stone-500 mt-1">{d}</p>
          </div>
        ))}
      </div>
    )
  },
  enterprise: {
    title: 'Built for enterprise IT & HR',
    subtitle: 'Unlimited usage, SSO, SCIM, a verified sending domain, and a careers hostname.',
    icon: Building2
  },
  security: {
    title: 'Security & compliance first',
    subtitle: 'Separate workspaces, role-based access, MFA, and an audit log on Professional and Enterprise.',
    icon: Shield
  },
  integrations: {
    title: 'What connects to the workspace',
    subtitle: 'Platform mail is included. Calendar and Slack follow the plan. Enterprise adds SSO, SCIM, and your own sending domain.',
    icon: Plug
  },
  'ai-automation': {
    title: 'AI that assists — you stay in control',
    subtitle: 'Resume help and drafting are available where the plan includes them. Mail and pipeline do not depend on them.',
    icon: Sparkles
  },
  faq: {
    title: 'Frequently asked questions',
    subtitle: 'Quick answers for buyers and admins.',
    body: (
      <div className="mt-10 space-y-4 max-w-2xl">
        {[
          ['Do you support SSO?', 'Yes. SSO and SCIM are on the Enterprise plan.'],
          ['How does email work?', 'Mail is included with the plan. You set the reply-to address. Enterprise can verify a sending domain. You do not set up a mail vendor.'],
          ['Where do I see limits?', 'The dashboard and Billing show seats, open jobs, candidates, and emails used this month.']
        ].map(([q, a]) => (
          <div key={q} className="rounded-2xl border border-stone-200 bg-white p-5">
            <h3 className="font-semibold text-stone-900">{q}</h3>
            <p className="text-sm text-stone-500 mt-1">{a}</p>
          </div>
        ))}
      </div>
    )
  },
  contact: {
    title: 'Talk to us',
    subtitle: 'Enterprise demos, migration help, and partnership inquiries.',
    body: (
      <div className="mt-10 max-w-lg rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-sm text-stone-600">Email <a className="text-brand-700 font-semibold" href="mailto:hello@skillnix.app">hello@skillnix.app</a> or start a free trial.</p>
        <Link to="/register" className="btn-primary inline-flex mt-5">Start free trial <ArrowRight className="w-4 h-4" /></Link>
      </div>
    )
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How we handle candidate and customer data.',
    body: <p className="mt-8 text-sm text-stone-600 max-w-2xl leading-relaxed">We process recruiting data as a processor for your organization. Candidates can request export or erasure via the candidate portal. Data is tenant-isolated by organizationId. Contact privacy@skillnix.app for DPA requests.</p>
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'The agreement for using SkillNix ATS.',
    body: <p className="mt-8 text-sm text-stone-600 max-w-2xl leading-relaxed">By using SkillNix you agree to lawful use of the platform for recruiting. You are responsible for candidate consent where required by local law (including messaging). Enterprise customers may execute a separate MSA/DPA.</p>
  },
  customers: {
    title: 'One workspace per organization',
    subtitle: 'In-house teams, agencies, and enterprise orgs use the same product. The plan changes the ceilings.',
    body: (
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['Faster shortlists', 'Cleaner pipelines', 'Audit-ready hiring'].map((t) => (
          <div key={t} className="rounded-2xl border border-stone-200 bg-white p-6 text-center font-semibold text-stone-800">{t}</div>
        ))}
      </div>
    )
  }
};

export default function MarketingPage() {
  const { pathname } = useLocation();
  const page = pathname.replace(/^\//, '') || 'features';
  const cfg = PAGES[page] || PAGES.features;
  const Icon = cfg.icon;
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = [
    ['/features', 'Features'],
    ['/pricing', 'Pricing'],
    ['/security', 'Security'],
    ['/enterprise', 'Enterprise']
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 via-white to-stone-50 overflow-x-hidden">
      <header className="border-b border-stone-200/80 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="font-bold text-stone-900 tracking-tight">People Connect HR</Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm text-stone-600">
            {nav.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-primary !py-2 !text-sm">Sign in</Link>
            <button type="button" className="sm:hidden p-2 rounded-xl text-stone-600 hover:bg-stone-100" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="sm:hidden border-t border-stone-100 px-4 py-3 flex flex-col gap-1 bg-white">
            {nav.map(([to, label]) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)} className="px-3 py-2.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-brand-50 hover:text-brand-800">
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <div className="max-w-3xl min-w-0">
          {Icon && <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mb-4"><Icon className="w-6 h-6" /></div>}
          <h1 className="text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight break-words" style={{ letterSpacing: '-0.03em' }}>{cfg.title}</h1>
          <p className="text-stone-500 mt-4 text-base sm:text-lg leading-relaxed">{cfg.subtitle}</p>
        </div>
        <div className="min-w-0">{cfg.body}</div>
      </main>
    </div>
  );
}
