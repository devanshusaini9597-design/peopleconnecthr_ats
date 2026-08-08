'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Check, X, Zap, Crown, Sparkles, ChevronDown,
  ArrowUpRight, Star, Users, TrendingUp, Sparkles as SparklesIcon,
  HeadphonesIcon, Globe, Lock, BarChart3, Rocket, RefreshCw, CheckCircle2, Shield,
} from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';

/* ─── Data ─────────────────────────────────────────────────────────────── */

const plansMeta = [
  {
    id: 'regular',
    icon: Zap,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    highlighted: false,
    name: 'License Regular',
    desc: 'Core ATS for everyday recruiting',
    cta: 'Choose Regular',
    badge: null as string | null,
    features: [
      'Full source code',
      'Candidates, jobs & Kanban',
      'Calendar, inbox & analytics',
      'Documentation included',
    ],
    missing: [
      'Extended commercial rights',
      'Priority support tier',
    ],
  },
  {
    id: 'extended',
    icon: Crown,
    iconBg: 'bg-brand-50',
    iconColor: 'text-brand-600',
    highlighted: true,
    name: 'License Extended',
    desc: 'Broader rights for agencies and resellers',
    cta: 'Choose Extended',
    badge: 'Extended',
    features: [
      'Everything in Regular',
      'Extended license rights',
      'Priority email support',
      'White-label ready',
    ],
    missing: [
      'None listed',
    ],
  },
];

type ComparisonRow = {
  feature: string;
  icon: React.ElementType;
  regular: string | boolean;
  extended: string | boolean;
};

const comparisonRows: ComparisonRow[] = [
  { feature: 'Source code access', icon: Users, regular: true, extended: true },
  { feature: 'Self-hosted deploy', icon: Rocket, regular: true, extended: true },
  { feature: 'Core ATS modules', icon: TrendingUp, regular: true, extended: true },

  { feature: 'Optional OpenAI tools', icon: SparklesIcon, regular: true, extended: true },
  { feature: 'Extended commercial rights', icon: BarChart3, regular: false, extended: true },

  { feature: 'Priority email support', icon: HeadphonesIcon, regular: false, extended: true },
  { feature: 'White-label ready', icon: Globe, regular: 'Basic branding', extended: true },
  { feature: 'REST API & webhooks', icon: Lock, regular: true, extended: true },
];

const pricingFaqs = [
  { q: 'What do I get with the purchase?', a: 'You receive the complete source code, documentation, and a license to use, modify, and extend the application for your own projects.' },
  { q: 'Can I change licenses later?', a: 'Yes. You can switch licenses as your team’s needs change.' },
  { q: 'Is support included?', a: 'Documentation is included. Extended license includes priority support via email.' },
  { q: 'What are the system requirements?', a: 'Node.js 18+, PostgreSQL 14+, and a server or cloud platform to deploy.' },
  { q: 'Is my data protected?', a: 'You host it yourself, so you fully control your data. The app includes standard security practices and access controls.' },
];

const trustLogos = ['Next.js', 'React', 'TypeScript', 'Prisma', 'Tailwind CSS', 'PostgreSQL'];

/* ─── Component ────────────────────────────────────────────────────────── */

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      </div>
    ) : (
      <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center mx-auto">
        <X className="w-3 h-3 text-stone-300" />
      </div>
    );
  }

  return <span className="font-bold text-stone-700">{value}</span>;
}

export default function PricingPage() {
  const { t } = useLocale();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const plans = plansMeta;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 pt-20 pb-28 sm:pt-28 sm:pb-36 px-4">
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.7) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-brand-500/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[200px] rounded-full bg-teal-500/15 blur-[80px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-brand-400 text-[11px] font-bold uppercase tracking-widest">
              License Options
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight mb-5"
          >
            Choose the right license{' '}
            <span className="bg-gradient-to-r from-brand-400 via-teal-400 to-brand-300 bg-clip-text text-transparent">
              for your team
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-stone-400 text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto"
          >
            One-time purchase with full source code. Self-hosted and fully customizable.
          </motion.p>
        </div>
      </section>

      {/* ── Plan Cards ───────────────────────────────────────────────────── */}
      <section className="relative bg-stone-50 px-4 sm:px-6 lg:px-8 -mt-16 pb-20 sm:pb-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
            {plans.map((plan, i) => {
              const Icon = plan.icon;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.08 + 0.15,
                    type: 'spring',
                    stiffness: 260,
                    damping: 22,
                  }}
                  className={`relative flex flex-col rounded-2xl ${
                    plan.highlighted
                      ? 'bg-gradient-to-br from-[#0f0f0f] to-[#0d1a1a] border-2 border-brand-500/60 shadow-[0_0_60px_-8px_rgba(13,148,136,0.35),0_32px_64px_-16px_rgba(0,0,0,0.4)] md:-translate-y-3'
                      : 'bg-white border border-stone-200 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.12)] hover:border-stone-300 transition-all duration-300'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide text-white shadow-lg bg-gradient-to-r from-brand-500 to-teal-500 shadow-brand-500/40">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-6 sm:p-7 flex-1 flex flex-col">
                    <div className="flex items-start gap-3.5 mb-5">
                      <div
                        className={`w-11 h-11 rounded-xl ${
                          plan.highlighted ? 'bg-brand-500/15' : plan.iconBg
                        } flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon
                          className={`w-5 h-5 ${
                            plan.highlighted ? 'text-brand-400' : plan.iconColor
                          }`}
                        />
                      </div>

                      <div>
                        <h3 className={`text-lg font-black ${plan.highlighted ? 'text-white' : 'text-stone-900'}`}>
                          {plan.name}
                        </h3>
                        <p className={`text-xs leading-snug mt-0.5 ${plan.highlighted ? 'text-stone-400' : 'text-stone-500'}`}>
                          {plan.desc}
                        </p>
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-widest">
                        <span
                          className={`${
                            plan.highlighted
                              ? 'text-white border-white/20 bg-white/10'
                              : 'text-brand-700 border-brand-200 bg-brand-50'
                          }`}
                        >
                          License options
                        </span>
                      </div>
                    </div>

                    <Link href="/signup" className="block mt-3 mb-5">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                          plan.highlighted
                            ? 'bg-gradient-to-r from-brand-500 to-teal-500 text-white shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50'
                            : 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm'
                        }`}
                      >
                        {plan.cta} <ArrowUpRight className="w-4 h-4" />
                      </motion.button>
                    </Link>

                    <div className={`h-px mb-5 ${plan.highlighted ? 'bg-white/10' : 'bg-stone-100'}`} />

                    <ul className="space-y-3 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              plan.highlighted ? 'bg-brand-500/20' : 'bg-emerald-50'
                            }`}
                          >
                            <Check className={`w-2.5 h-2.5 ${plan.highlighted ? 'text-brand-400' : 'text-emerald-600'}`} />
                          </div>
                          <span className={plan.highlighted ? 'text-stone-300' : 'text-stone-700'}>{f}</span>
                        </li>
                      ))}

                      {plan.missing.filter((x) => x !== 'None included').map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-stone-100">
                            <X className="w-2.5 h-2.5 text-stone-300" />
                          </div>
                          <span className="text-stone-400">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          >
            {[
              { icon: Shield, text: 'Standard security practices' },
              { icon: RefreshCw, text: 'Switch licenses as needed' },
              { icon: CheckCircle2, text: 'Full source code' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-stone-500">
                <Icon className="w-4 h-4 text-brand-500 flex-shrink-0" />
                <span className="font-medium">{text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Social proof ─────────────────────────────────────────────── */}
      <section className="py-12 px-4 border-y border-stone-100 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Trusted by teams</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {trustLogos.map((logo) => (
              <span key={logo} className="text-sm font-black text-stone-300 tracking-wide">{logo}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ─────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mb-3">Compare features</h2>
            <p className="text-stone-500 text-sm sm:text-base max-w-md mx-auto">
              Regular vs Extended — side by side.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-x-auto rounded-2xl border border-stone-200 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]"
          >
            <table className="w-full text-sm min-w-[540px]">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="p-5 text-left w-[40%]">
                    <span className="text-xs font-black text-stone-400 uppercase tracking-widest">Feature</span>
                  </th>
                  {plans.map((p) => (
                    <th
                      key={p.id}
                      className={`p-5 text-center ${p.highlighted ? 'bg-gradient-to-b from-brand-50 to-teal-50/30' : ''}`}
                    >
                      <span className={`text-sm font-black ${p.highlighted ? 'text-brand-700' : 'text-stone-700'}`}>
                        {p.id === 'extended' ? 'Extended' : 'Regular'}
                      </span>
                      {p.highlighted && <div className="mt-1 w-6 h-0.5 bg-gradient-to-r from-brand-500 to-teal-500 rounded-full mx-auto" />}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                    <td className="p-4 font-medium text-stone-700 border-b border-stone-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                          <row.icon className="w-3.5 h-3.5 text-stone-400" />
                        </div>
                        {row.feature}
                      </div>
                    </td>

                    <td className="p-4 text-center border-b border-stone-100">
                      <FeatureValue value={row.regular} />
                    </td>

                    <td className="p-4 text-center border-b border-stone-100 bg-brand-50/20">
                      <FeatureValue value={row.extended} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-stone-50 border-t border-stone-100">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mb-3">Frequently asked questions</h2>
            <p className="text-stone-500 text-sm sm:text-base">
              Can't find what you're looking for?{' '}
              <Link href="/contact" className="text-brand-600 font-semibold hover:underline">Talk to us</Link>.
            </p>
          </motion.div>

          <div className="space-y-2">
            {pricingFaqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left"
                >
                  <span className="font-bold text-stone-900 text-sm sm:text-base pr-4">{faq.q}</span>
                  <motion.div
                    animate={{ rotate: openFaq === i ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0 w-7 h-7 rounded-xl bg-stone-100 flex items-center justify-center"
                  >
                    <ChevronDown className="w-4 h-4 text-stone-500" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                    >
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-stone-600 text-sm leading-relaxed border-t border-stone-100 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <CTASection title={t('pricing.ctaTitle')} subtitle={t('pricing.ctaSubtitle')} />
    </>
  );
}
