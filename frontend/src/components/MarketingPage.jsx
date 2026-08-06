import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Shield, Sparkles, Plug, Building2, CheckCircle2, Menu, X } from 'lucide-react';

const PAGES = {
  pricing: {
    title: 'Pricing that scales with hiring',
    subtitle: 'Start free. Upgrade when your team is ready for enterprise controls.',
    body: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
        {[
          { name: 'Starter', price: '$29', items: ['Core ATS', 'Pipeline', 'MFA', 'Basic analytics'] },
          { name: 'Professional', price: '$99', items: ['AI tools', 'Inbox & sequences', 'Skills taxonomy', 'Assessments', 'BYOK email/calendar'] },
          { name: 'Enterprise', price: 'Custom', items: ['SSO + SCIM', 'DEI suite', 'IP allowlist', 'SIEM / DWH', 'Dedicated deployment'] }
        ].map((p) => (
          <div key={p.name} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-stone-900">{p.name}</h3>
            <p className="text-3xl font-bold text-brand-700 mt-2">{p.price}<span className="text-sm font-medium text-stone-400">/mo</span></p>
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
    subtitle: 'Pipeline, AI screening, assessments, DEI, and enterprise security — in one SaaS ATS.',
    body: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
        {[
          ['Unified inbox', 'Email, SMS, WhatsApp in one thread'],
          ['Skills taxonomy', 'Structured match scoring'],
          ['Proctored assessments', 'Integrity risk scoring'],
          ['Sequences', 'Multi-step nurture automation'],
          ['DEI controls', 'Blind screening & slate alerts'],
          ['BYOK integrations', 'Bring your own keys for AI, SMS, storage']
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-stone-200 bg-white p-5">
            <h3 className="font-bold text-stone-900">{t}</h3>
            <p className="text-sm text-stone-500 mt-1">{d}</p>
          </div>
        ))}
      </div>
    )
  },
  enterprise: {
    title: 'Built for enterprise IT & HR',
    subtitle: 'SSO, SCIM, audit logs, retention, legal hold, and dedicated deployment options.',
    icon: Building2
  },
  security: {
    title: 'Security & compliance first',
    subtitle: 'MFA, IP allowlists, encrypted BYOK credentials, GDPR export/erase, and audit trails.',
    icon: Shield
  },
  integrations: {
    title: 'Plug-and-play BYOK integrations',
    subtitle: 'Connect your own OpenAI, Twilio, DocuSign, Checkr, Slack, calendars, CRM, and HRIS.',
    icon: Plug
  },
  'ai-automation': {
    title: 'AI that assists — you stay in control',
    subtitle: 'JD generation, semantic search, resume scoring, interview summaries — with your keys.',
    icon: Sparkles
  },
  faq: {
    title: 'Frequently asked questions',
    subtitle: 'Quick answers for buyers and admins.',
    body: (
      <div className="mt-10 space-y-4 max-w-2xl">
        {[
          ['Do you support SSO?', 'Yes — SAML/OIDC on Enterprise, plus SCIM provisioning.'],
          ['Is messaging BYOK?', 'Yes. Bring Twilio/WhatsApp and SMTP/SendGrid credentials per org.'],
          ['Can we self-host AI?', 'Use Azure OpenAI or Anthropic via BYOK adapters — no vendor lock-in on model keys.']
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
    title: 'Trusted by growing hiring teams',
    subtitle: 'From startups to multi-brand agencies.',
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
          <Link to="/" className="font-bold text-brand-800 tracking-tight">SkillNix</Link>
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
