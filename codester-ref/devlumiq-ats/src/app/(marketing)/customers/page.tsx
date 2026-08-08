'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import {
  Building2, Award, ArrowRight, Quote, Star,
  CheckCircle2, Zap, ChevronRight, Trophy, Users, TrendingUp, Globe,
} from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';

const companyData = [
  {
    company: 'In-house HR',
    logo: 'HR',
    industryKey: 'customers.cs1.industry',
    size: 'Product teams',
    quoteKey: 'customers.cs1.quote',
    author: 'Use case',
    roleKey: 'customers.cs1.role',
    color: 'from-blue-500 to-cyan-600',
    glow: 'group-hover:shadow-blue-500/20',
    metrics: [
      { value: 'Yes', labelKey: 'customers.cs1.m1', bar: 90 },
      { value: 'Yes', labelKey: 'customers.cs1.m2', bar: 85 },
      { value: 'Yes', labelKey: 'customers.cs1.m3', bar: 95 },
    ],
  },
  {
    company: 'Growing startups',
    logo: 'ST',
    industryKey: 'customers.cs2.industry',
    size: 'Lean hiring',
    quoteKey: 'customers.cs2.quote',
    author: 'Use case',
    roleKey: 'customers.cs2.role',
    color: 'from-teal-500 to-emerald-600',
    glow: 'group-hover:shadow-teal-500/20',
    metrics: [
      { value: 'Yes', labelKey: 'customers.cs2.m1', bar: 88 },
      { value: 'Opt', labelKey: 'customers.cs2.m2', bar: 70 },
      { value: 'Yes', labelKey: 'customers.cs2.m3', bar: 92 },
    ],
  },
  {
    company: 'Agencies',
    logo: 'AG',
    industryKey: 'customers.cs3.industry',
    size: 'Multi-role',
    quoteKey: 'customers.cs3.quote',
    author: 'Use case',
    roleKey: 'customers.cs3.role',
    color: 'from-violet-500 to-purple-600',
    glow: 'group-hover:shadow-violet-500/20',
    metrics: [
      { value: 'Yes', labelKey: 'customers.cs3.m1', bar: 90 },
      { value: 'Yes', labelKey: 'customers.cs3.m2', bar: 85 },
      { value: 'Yes', labelKey: 'customers.cs3.m3', bar: 100 },
    ],
  },
];

const testimonialData = [
  { quoteKey: 'customers.cs1.quote', author: 'Pipeline & calendar', roleKey: 'customers.cs1.role', company: 'Core ATS', rating: 5 },
  { quoteKey: 'customers.cs2.quote', author: 'Careers + AI tools', roleKey: 'customers.cs2.role', company: 'Growth teams', rating: 5 },
  { quoteKey: 'customers.cs3.quote', author: 'Reports & source', roleKey: 'customers.cs3.role', company: 'Agencies', rating: 5 },
  { quoteKey: 'customers.cs1.quote', author: 'Self-hosted data', roleKey: 'customers.cs1.role', company: 'IT / security', rating: 5 },
];

const industryKeys = [
  'customers.ind1', 'customers.ind2', 'customers.ind3', 'customers.ind4',
  'customers.ind5', 'customers.ind6', 'customers.ind7', 'customers.ind8',
  'customers.ind9', 'customers.ind10',
];

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 80));
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setCount(current);
      if (current >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

function MetricBar({ value, label, bar, idx }: { value: string; label: string; bar: number; idx: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-stone-500 truncate pr-2">{label}</span>
        <span className="text-sm font-bold text-stone-900 flex-shrink-0">{value}</span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${bar}%` } : {}}
          transition={{ duration: 1.1, delay: idx * 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500"
        />
      </div>
    </div>
  );
}

function ProofCard({ name, company, score, xCls, yCls, delay }: {
  name: string; company: string; score: string; xCls: string; yCls: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
      transition={{
        opacity: { delay, duration: 0.5 },
        scale: { delay, duration: 0.5 },
        y: { delay: delay + 0.6, duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
      }}
      className={`absolute ${xCls} ${yCls} hidden lg:flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl`}
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-teal-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {name.split(' ').map((n: string) => n[0]).join('')}
      </div>
      <div>
        <p className="text-white text-xs font-semibold leading-none mb-0.5">{name}</p>
        <p className="text-stone-400 text-[10px] leading-none">{company}</p>
      </div>
      <div className="flex items-center gap-0.5 ml-1">
        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
        <span className="text-white text-xs font-bold">{score}</span>
      </div>
    </motion.div>
  );
}

export default function CustomersPage() {
  const { t } = useLocale();

  const heroStats = [
    { display: '10', label: t('customers.stat1.label'), Icon: Globe },
    { display: '5', label: t('customers.stat2.label'), Icon: Users },
    { display: 'Yes', label: t('customers.stat3.label'), Icon: Building2 },
    { display: 'Yes', label: t('customers.stat4.label'), Icon: Star },
  ];

  const trustBadges = [
    {
      Icon: Trophy,
      badge: 'Open Source',
      sub: 'Transparent & auditable',
      score: 'MIT',
      count: 'License',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      Icon: Star,
      badge: 'Modern Stack',
      sub: 'Next.js · TypeScript · Prisma',
      score: 'Full',
      count: 'Stack',
      gradient: 'from-blue-500 to-indigo-600',
    },
    {
      Icon: Zap,
      badge: 'Production Ready',
      sub: 'RBAC · Audit Logs · TLS',
      score: 'Secure',
      count: 'By default',
      gradient: 'from-amber-500 to-orange-500',
    },
  ];

  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden bg-slate-950">
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '56px 56px',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 90% 55% at 40% -10%, rgba(20,184,166,0.2), transparent 70%)' }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-stone-50 to-transparent" />

        <ProofCard name="Kanban" company="Pipeline" score="Live" xCls="right-12" yCls="top-32" delay={0.7} />
        <ProofCard name="Careers" company="Apply flow" score="Built-in" xCls="right-8" yCls="bottom-40" delay={0.9} />
        <ProofCard name="Analytics" company="Reports" score="PDF" xCls="right-32" yCls="top-56" delay={1.1} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.13 } } }}
            className="max-w-3xl"
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/8 border border-white/10 mb-8"
            >
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
              </span>
              <span className="text-sm font-semibold text-stone-300">{t('customers.hero.badge')}</span>
            </motion.div>

            <motion.h1
              variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
              className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white tracking-tight mb-6 leading-[1.04]"
            >
              {t('customers.hero.title')}
              <span className="block bg-gradient-to-r from-brand-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                {t('customers.hero.titleHighlight')}
              </span>
            </motion.h1>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              className="text-lg sm:text-xl text-stone-400 max-w-2xl mb-10 leading-relaxed"
            >
              {t('customers.hero.desc')}
            </motion.p>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="#case-studies">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 transition-all"
                >
                  {t('customers.hero.cta1')}
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
              <Link href="/contact">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-8 py-4 bg-white/8 text-white rounded-xl font-bold border border-white/12 hover:bg-white/14 transition-colors"
                >
                  {t('customers.hero.cta2')}
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16">
            {heroStats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.1 }}
                className="relative p-5 rounded-2xl bg-white/5 border border-white/8 backdrop-blur-sm text-center overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent" />
                <stat.Icon className="w-5 h-5 text-brand-400 mx-auto mb-2" />
                <p className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
                  {stat.display}
                </p>
                <p className="text-xs text-stone-400 leading-tight">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CASE STUDIES */}
      <section id="case-studies" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 text-brand-700 text-sm font-semibold mb-6">
              <Award className="w-4 h-4" />
              {t('customers.stories.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 mb-4">
              {t('customers.stories.title')}
            </h2>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto">{t('customers.stories.subtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {companyData.map((cs, i) => (
              <motion.article
                key={cs.company}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                whileHover={{ y: -6 }}
                className={`group relative rounded-2xl overflow-hidden bg-white border border-stone-200 hover:border-transparent hover:shadow-2xl ${cs.glow} transition-all duration-300`}
              >
                <div className={`relative p-6 bg-gradient-to-br ${cs.color} overflow-hidden`}>
                  <div
                    className="absolute inset-0 opacity-25"
                    style={{ backgroundImage: `radial-gradient(circle at 75% 75%, rgba(255,255,255,0.35), transparent 55%)` }}
                  />
                  <div className="relative flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white/25 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg flex-shrink-0">
                      <span className="text-xl font-extrabold text-white">{cs.logo}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight">{cs.company}</h3>
                      <p className="text-white/75 text-sm">{t(cs.industryKey)}  {cs.size} emp.</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <Quote className="w-7 h-7 text-brand-200 mb-2 flex-shrink-0" />
                  <p className="text-stone-700 italic leading-relaxed mb-5 text-sm line-clamp-3">{t(cs.quoteKey)}</p>

                  <div className="flex items-center gap-3 mb-5 pb-5 border-b border-stone-100">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(cs.author)}&background=e7f9f7&color=0d9488&size=80&bold=true`}
                      alt={cs.author}
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                      loading="lazy"
                    />
                    <div>
                      <p className="font-semibold text-stone-900 text-sm leading-tight">{cs.author}</p>
                      <p className="text-xs text-stone-500">{t(cs.roleKey)}</p>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  <div>
                    {cs.metrics.map((m, j) => (
                      <MetricBar key={j} value={m.value} label={t(m.labelKey)} bar={m.bar} idx={j} />
                    ))}
                  </div>

                  <motion.button
                    whileHover={{ x: 4 }}
                    className="mt-5 flex items-center gap-1.5 text-brand-600 font-semibold text-sm hover:text-brand-700 transition-colors"
                  >
                    {t('customers.readStory')}
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES MARQUEE */}
      <section className="py-16 bg-white border-y border-stone-100 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-brand-500" />
              <h2 className="text-2xl font-extrabold text-stone-900">{t('customers.industries.title')}</h2>
            </div>
            <p className="text-stone-500">{t('customers.industries.subtitle')}</p>
          </motion.div>
        </div>

        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 22, ease: 'linear', repeat: Infinity }}
            className="flex gap-4 w-max"
          >
            {[...industryKeys, ...industryKeys].map((key, i) => (
              <span
                key={i}
                className="px-5 py-2.5 rounded-full bg-stone-50 border border-stone-200 text-stone-700 font-medium text-sm whitespace-nowrap shadow-sm select-none"
              >
                {t(key)}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-sm font-semibold mb-6">
              <Star className="w-4 h-4 fill-amber-500" />
              {t('customers.testimonials.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900">
              {t('customers.testimonials.title')}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonialData.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="group p-7 rounded-2xl bg-white border border-stone-200 hover:border-brand-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex gap-1 mb-5">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-stone-700 mb-6 leading-relaxed">"{t(testimonial.quoteKey)}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center flex-shrink-0 border border-brand-200">
                    <span className="text-sm font-bold text-brand-700">
                      {testimonial.author.split(' ').map((n: string) => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900">{testimonial.author}</p>
                    <p className="text-sm text-stone-500">{t(testimonial.roleKey)}, {testimonial.company}</p>
                  </div>
                  <div className="ml-auto">
                    <CheckCircle2 className="w-5 h-5 text-teal-500" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">{t('customers.trust.title')}</h2>
            <p className="text-stone-400">{t('customers.trust.subtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {trustBadges.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.88 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                whileHover={{ y: -4 }}
                className="relative p-7 rounded-2xl bg-white/5 border border-white/8 hover:border-white/18 hover:bg-white/8 transition-all text-center overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/3 to-transparent" />
                <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                  <item.Icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-3xl font-extrabold text-white mb-1">{item.score}</p>
                <p className="font-semibold text-stone-200 text-sm mb-1">{item.badge}</p>
                <p className="text-stone-500 text-xs mb-0.5">{item.sub}</p>
                <p className="text-stone-600 text-xs">{item.count}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title={t('customers.cta.title')}
        subtitle={t('customers.cta.subtitle')}
      />
    </>
  );
}
