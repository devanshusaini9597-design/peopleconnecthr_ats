'use client';

import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import {
  Plug, Zap, Linkedin, Slack, Calendar, Mail, FileText,
  Shield, CheckCircle2, ArrowRight, ArrowUpRight,
  Globe, Code, RefreshCw, Lock, Workflow, MessageSquare, Chrome, Filter, ExternalLink,
  Sparkles, Terminal, Copy, Check
} from 'lucide-react';
import { useState } from 'react';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

type TabKey = 'all' | 'jobboards' | 'communication' | 'calendar' | 'hr' | 'background' | 'productivity';

interface Integration {
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  connected: boolean;
  category: TabKey;
  setupTime: string;
}

const integrations: Integration[] = [
  { name: 'LinkedIn', desc: 'Post jobs when org credentials are configured', icon: Linkedin, color: 'text-blue-400', bg: 'bg-blue-500/15', connected: true, category: 'jobboards', setupTime: 'Credentials' },
  { name: 'Indeed', desc: 'Post jobs when org credentials are configured', icon: Globe, color: 'text-orange-400', bg: 'bg-orange-500/15', connected: true, category: 'jobboards', setupTime: 'Credentials' },
  { name: 'Glassdoor', desc: 'Post jobs when org credentials are configured', icon: Shield, color: 'text-green-400', bg: 'bg-green-500/15', connected: true, category: 'jobboards', setupTime: 'Credentials' },
  { name: 'SMTP Email', desc: 'Nodemailer — configure SMTP in .env', icon: Mail, color: 'text-red-400', bg: 'bg-red-500/15', connected: true, category: 'communication', setupTime: 'Env' },
  { name: 'WhatsApp', desc: 'Business API candidate messaging', icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/15', connected: true, category: 'communication', setupTime: 'API key' },
  { name: 'Slack', desc: 'Planned — not connected yet', icon: Slack, color: 'text-violet-400', bg: 'bg-violet-500/15', connected: false, category: 'communication', setupTime: 'Planned' },
  { name: 'Outlook', desc: 'Planned — not connected yet', icon: Mail, color: 'text-blue-400', bg: 'bg-blue-500/15', connected: false, category: 'communication', setupTime: 'Planned' },
  { name: 'Google Calendar', desc: 'Local events by default; OAuth sync optional', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/15', connected: false, category: 'calendar', setupTime: 'Optional' },
  { name: 'Checkr', desc: 'Background checks via Checkr API', icon: Shield, color: 'text-blue-400', bg: 'bg-blue-600/15', connected: true, category: 'background', setupTime: 'API key' },
  { name: 'Zapier', desc: 'Webhook-based automation', icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/15', connected: true, category: 'productivity', setupTime: 'Webhooks' },
  { name: 'Chrome Extension', desc: 'LinkedIn one-click import', icon: Chrome, color: 'text-blue-400', bg: 'bg-blue-500/15', connected: true, category: 'productivity', setupTime: 'Token' },
  { name: 'OpenAI', desc: 'Optional AI parse, rank, screen, JD, email', icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-500/15', connected: true, category: 'productivity', setupTime: 'Optional' },
  { name: 'SSO / SAML', desc: 'Opt-in enterprise authentication', icon: Lock, color: 'text-cyan-400', bg: 'bg-cyan-500/15', connected: true, category: 'hr', setupTime: 'Opt-in' },
  { name: 'DocuSign', desc: 'Stub — workflow ready, bring your own SDK', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/15', connected: false, category: 'productivity', setupTime: 'Stub' },
  { name: 'REST API', desc: 'App API routes for candidates, jobs, and more', icon: Code, color: 'text-teal-400', bg: 'bg-teal-500/15', connected: true, category: 'productivity', setupTime: 'Built-in' },
  { name: 'Webhooks', desc: 'Event push for automation', icon: RefreshCw, color: 'text-brand-400', bg: 'bg-brand-500/15', connected: true, category: 'productivity', setupTime: 'Built-in' },
];

const tabKeys: TabKey[] = ['all', 'jobboards', 'communication', 'calendar', 'hr', 'background', 'productivity'];

const codeSnippet = `// Example: list candidates from your deployed app
const res = await fetch(
  'https://your-ats.example.com/api/candidates',
  {
    headers: {
      'Cookie': 'session=...', // JWT httpOnly cookie auth
      'Content-Type': 'application/json',
    }
  }
);

const data = await res.json();
// Returns candidates from your PostgreSQL database`;

function CodeWindow({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-2xl border border-white/12 overflow-hidden bg-[#0d0d0d] shadow-2xl">
      {/* Window bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/60" />
          <div className="w-3 h-3 rounded-full bg-amber-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30">
          <Terminal className="w-3.5 h-3.5" />
          <span>candidates.ts</span>
        </div>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {/* Code */}
      <pre className="p-6 text-xs leading-relaxed overflow-x-auto">
        <code>
          {codeSnippet.split('\n').map((line, i) => (
            <div key={i} className="flex gap-4">
              <span className="select-none text-white/15 w-4 text-right flex-shrink-0">{i + 1}</span>
              <span className={
                line.startsWith('//') ? 'text-white/30' :
                line.includes("'") ? 'text-emerald-400' :
                line.includes('await') || line.includes('const') || line.includes('Bearer') ? 'text-teal-300' :
                'text-white/75'
              }>{line}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

export default function IntegrationsPage() {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [copied, setCopied] = useState(false);

  const filtered = activeTab === 'all' ? integrations : integrations.filter(x => x.category === activeTab);
  const connectedCount = integrations.filter(x => x.connected).length;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { value: `${integrations.length}`, label: t('integrations.stat1.label') },
    { value: `${connectedCount}`, label: t('integrations.connected') },
    { value: 'You host', label: t('integrations.stat2.label') },
    { value: 'Your infra', label: t('integrations.stat3.label') },
  ];

  const apiFeaturesKeys = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];

  return (
    <main className="overflow-hidden">

      {/* ── HERO ── dark slate */}
      <section className="relative min-h-[85vh] flex items-center justify-center px-6 pt-28 pb-20 bg-slate-950">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-teal-500/8 rounded-full blur-[100px] pointer-events-none" />
        {/* Floating integration dots */}
        {[
          { top: '20%', left: '8%', color: 'bg-blue-400/50', delay: 0 },
          { top: '35%', right: '10%', color: 'bg-teal-400/50', delay: 1.5 },
          { top: '65%', left: '6%', color: 'bg-violet-400/50', delay: 0.8 },
          { top: '75%', right: '7%', color: 'bg-amber-400/50', delay: 2 },
          { top: '15%', right: '18%', color: 'bg-emerald-400/40', delay: 1 },
        ].map((dot, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -10, 0], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3 + i * 0.7, repeat: Infinity, delay: dot.delay, ease: 'easeInOut' }}
            className={`absolute w-2 h-2 rounded-full ${dot.color} blur-sm hidden lg:block pointer-events-none`}
            style={{ top: dot.top, left: (dot as any).left, right: (dot as any).right }}
          />
        ))}

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-400 text-sm font-medium mb-8">
              <Plug className="w-3.5 h-3.5" />
              {t('integrations.hero.badge')}
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6 text-white">
              {t('integrations.hero.title')}{' '}
              <span className="bg-gradient-to-r from-brand-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                {t('integrations.hero.titleHighlight')}
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t('integrations.hero.desc')}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
              <Link href="/signup" className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-teal-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-brand-500/20">
                {t('integrations.hero.cta1')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/docs" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 text-white/80 font-semibold text-sm hover:border-white/40 hover:text-white transition-colors backdrop-blur-sm">
                <Code className="w-4 h-4" />
                {t('integrations.hero.cta2')}
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10">
              {stats.map((s, i) => (
                <motion.div key={i} variants={scaleIn} className="bg-white/[0.05] px-6 py-6 text-center hover:bg-white/[0.09] transition-colors">
                  <div className="text-3xl font-black text-white mb-1">{s.value}</div>
                  <div className="text-xs text-white/45 uppercase tracking-widest">{s.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── INTEGRATION GRID ── white */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold uppercase tracking-widest mb-4">
              <Filter className="w-3 h-3" />
              {t('integrations.grid.badge')}
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">{t('integrations.grid.title')}</motion.h2>
            <motion.p variants={fadeUp} className="text-stone-500 max-w-2xl mx-auto">{t('integrations.grid.subtitle')}</motion.p>
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex flex-wrap gap-2 justify-center mb-10">
            {tabKeys.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-brand-500 to-teal-500 text-white shadow-md shadow-brand-500/20'
                    : 'border border-stone-200 text-stone-500 hover:text-slate-900 hover:border-stone-300 bg-white shadow-sm'
                }`}
              >
                {t(`integrations.tab.${tab}`)}
                {tab !== 'all' && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-white/20' : 'bg-stone-100 text-stone-400'}`}>
                    {integrations.filter(x => x.category === tab).length}
                  </span>
                )}
              </button>
            ))}
          </motion.div>

          {/* Grid */}
          <motion.div
            key={activeTab}
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
          >
            {filtered.map((intg, i) => (
              <motion.div
                key={intg.name}
                variants={scaleIn}
                whileHover={{ y: -4, scale: 1.03 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className={`group relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 shadow-sm hover:shadow-md ${
                  intg.connected
                    ? 'border-teal-200 bg-teal-50/60 hover:bg-teal-50 hover:border-teal-300'
                    : 'border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300'
                }`}
              >
                {/* Connected dot */}
                {intg.connected && (
                  <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-teal-500 shadow-sm" />
                )}
                <div className={`w-10 h-10 rounded-xl ${intg.bg} border ${intg.connected ? 'border-teal-200' : 'border-stone-200'} flex items-center justify-center flex-shrink-0`}>
                  <intg.icon className={`w-5 h-5 ${intg.color}`} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm leading-tight mb-0.5">{intg.name}</p>
                  <p className="text-stone-400 text-xs leading-snug line-clamp-2">{intg.desc}</p>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  {intg.connected
                    ? <span className="inline-flex items-center gap-1 text-xs text-teal-600 font-medium"><CheckCircle2 className="w-3 h-3" />{t('integrations.connected')}</span>
                    : <span className="text-xs text-stone-400">{intg.setupTime}</span>}
                  <ExternalLink className="w-3 h-3 text-stone-300 group-hover:text-stone-500 transition-colors" />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Summary footer */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-stone-400">
            <span>{filtered.length} integrations</span>
            <span className="hidden sm:block">&bull;</span>
            <span>{filtered.filter(x => x.connected).length} {t('integrations.connected').toLowerCase()}</span>
          </motion.div>
        </div>
      </section>

      {/* ── THREE PILLARS ── stone-50 */}
      <section className="py-24 px-6 bg-stone-50">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { key: 'sync', icon: RefreshCw, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
            { key: 'security', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { key: 'workflow', icon: Workflow, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
          ].map(({ key, icon: Icon, color, bg, border }, i) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ delay: i * 0.1 }}
              className={`p-7 rounded-2xl border ${border} bg-white shadow-sm hover:shadow-md transition-all group`}
            >
              <div className={`inline-flex p-3 rounded-xl ${bg} border ${border} mb-5`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="text-slate-900 font-bold text-lg mb-2">{t(`integrations.${key}`)}</h3>
              <p className="text-stone-500 text-sm leading-relaxed">{t(`integrations.${key}Desc`)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── API SECTION ── dark slate */}
      <section className="py-28 px-6 bg-slate-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-brand-500/6 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-xs font-semibold uppercase tracking-widest mb-6">
                <Code className="w-3 h-3" />
                {t('integrations.api.badge')}
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight mb-5 text-white">{t('integrations.api.title')}</motion.h2>
              <motion.p variants={fadeUp} className="text-white/55 leading-relaxed mb-8">{t('integrations.api.sectionDesc')}</motion.p>
              <motion.ul variants={stagger} className="space-y-3 mb-8">
                {apiFeaturesKeys.map((k) => (
                  <motion.li key={k} variants={fadeUp} className="flex items-center gap-3 text-white/75 text-sm">
                    <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-teal-400" />
                    </div>
                    {t(`integrations.api.${k}`)}
                  </motion.li>
                ))}
              </motion.ul>
              <motion.div variants={fadeUp}>
                <Link href="/docs" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500/15 to-brand-500/15 border border-teal-500/25 text-teal-300 font-semibold text-sm hover:from-teal-500/25 hover:to-brand-500/25 transition-colors">
                  {t('integrations.developerApi')}
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <CodeWindow copied={copied} onCopy={handleCopy} />
              {/* Endpoint pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {['GET /candidates', 'POST /jobs', 'PATCH /pipeline', 'GET /analytics'].map(ep => (
                  <span key={ep} className="px-3 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-xs text-white/50 font-mono">
                    {ep}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── DEVELOPER API BADGES ── white */}
      <section className="py-20 px-6 bg-white border-b border-stone-100">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Code, label: 'REST API', sub: 'Full CRUD endpoints', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
              { icon: Shield, label: 'JWT Auth', sub: 'Secure by default', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { icon: RefreshCw, label: 'Webhooks', sub: 'Real-time events', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
              { icon: Globe, label: 'RBAC', sub: '5 built-in roles', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
            ].map(({ icon: Icon, label, sub, color, bg, border }, i) => (
              <motion.div key={i} variants={scaleIn} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300 }}
                className={`flex flex-col items-center text-center p-6 rounded-2xl border ${border} ${bg} shadow-sm hover:shadow-md transition-all`}>
                <div className={`w-12 h-12 rounded-2xl bg-white border ${border} flex items-center justify-center mb-4 shadow-sm`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="text-slate-900 font-bold text-sm mb-1">{label}</div>
                <div className="text-stone-500 text-xs">{sub}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <CTASection
        title={t('integrations.cta.title')}
        subtitle={t('integrations.cta.subtitle')}
      />
    </main>
  );
}
