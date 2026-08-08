'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Brain, Target, Bot, Mail, Calendar, BarChart3,
  Zap, CheckCircle2, ArrowRight, Cpu, TrendingUp,
  Clock, Shield, Star, Sparkles, ChevronRight
} from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedSection({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const aiFeatures = [
  { icon: Brain,    key: 'f1', bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100' },
  { icon: Target,   key: 'f2', bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-100'   },
  { icon: Bot,      key: 'f3', bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-100'   },
  { icon: Mail,     key: 'f4', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100'},
  { icon: Calendar, key: 'f5', bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100'  },
  { icon: BarChart3,key: 'f6', bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-100'   },
];

const pipelineSteps = [
  { icon: Cpu,          key: 's1', color: 'text-teal-500',    bg: 'bg-teal-50',    border: 'border-teal-200'    },
  { icon: Brain,        key: 's2', color: 'text-violet-500',  bg: 'bg-violet-50',  border: 'border-violet-200'  },
  { icon: Target,       key: 's3', color: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200'    },
  { icon: Calendar,     key: 's4', color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { icon: CheckCircle2, key: 's5', color: 'text-green-500',   bg: 'bg-green-50',   border: 'border-green-200'   },
];

const howSteps = [
  { icon: Zap,        key: 's1', accent: 'text-teal-400',   num: '01' },
  { icon: Brain,      key: 's2', accent: 'text-violet-400', num: '02' },
  { icon: TrendingUp, key: 's3', accent: 'text-blue-400',   num: '03' },
];

const results = [
  { key: 'r1', icon: Clock,      color: 'text-teal-600',   bg: 'bg-teal-50'   },
  { key: 'r2', icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
  { key: 'r3', icon: Target,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { key: 'r4', icon: Star,       color: 'text-amber-600',  bg: 'bg-amber-50'  },
];

export default function AIAutomationPage() {
  const { t } = useLocale();

  return (
    <main className="min-h-screen bg-white">

      {/* ── HERO — dark slate-950 ────────────────────────────────────── */}
      <section className="relative bg-slate-950 overflow-hidden">
        {/* Ambient glows + dot grid */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle, #71717a 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 md:pt-36 md:pb-32">
          <AnimatedSection className="text-center mx-auto max-w-4xl">

            {/* Badge */}
            <motion.div variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              {t('ai.hero.badge')}
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={fadeUp}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-tight mb-6">
              {t('ai.hero.title')}
              <span className="block bg-gradient-to-r from-teal-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent mt-2">
                {t('ai.hero.titleAccent')}
              </span>
            </motion.h1>

            {/* Description */}
            <motion.p variants={fadeUp}
              className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
              {t('ai.hero.desc')}
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold text-base hover:shadow-lg hover:shadow-teal-500/30 transition-all hover:-translate-y-0.5">
                {t('ai.hero.cta1')} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="#how-it-works"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white font-semibold text-base transition-all">
                {t('ai.hero.cta2')} <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Stats strip */}
            <motion.div variants={fadeUp}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 pt-10 border-t border-slate-800">
              {['stat1', 'stat2', 'stat3', 'stat4'].map((s) => (
                <div key={s} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                    {t('ai.' + s + '.value')}
                  </div>
                  <div className="text-sm text-slate-400">{t('ai.' + s + '.label')}</div>
                </div>
              ))}
            </motion.div>

          </AnimatedSection>
        </div>
      </section>

      {/* ── AI FEATURES BENTO — white ────────────────────────────────── */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <AnimatedSection className="text-center mb-16">
            <motion.span variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm font-medium mb-4">
              <Brain className="w-4 h-4" />{t('ai.features.badge')}
            </motion.span>
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t('ai.features.title')}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-stone-500 max-w-2xl mx-auto">
              {t('ai.features.subtitle')}
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {aiFeatures.map(({ icon: Icon, key, bg, text, border }) => (
              <motion.div key={key} variants={fadeUp}
                className="group p-7 rounded-2xl border border-stone-100 bg-white hover:shadow-xl hover:shadow-stone-100/80 hover:-translate-y-1 transition-all duration-300">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${bg} border ${border} mb-5 ${text}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('ai.' + key + '.title')}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{t('ai.' + key + '.desc')}</p>
              </motion.div>
            ))}
          </AnimatedSection>

        </div>
      </section>

      {/* ── PIPELINE VISUALIZER — stone-50 ──────────────────────────── */}
      <section className="bg-stone-50 py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #78716c 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <AnimatedSection className="text-center mb-16">
            <motion.span variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-sm font-medium mb-4">
              <Cpu className="w-4 h-4" />{t('ai.pipeline.badge')}
            </motion.span>
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t('ai.pipeline.title')}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-stone-500 max-w-2xl mx-auto">
              {t('ai.pipeline.subtitle')}
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="relative">
            {/* Connector line — desktop only */}
            <div className="hidden lg:block absolute top-10 left-[10%] right-[10%] h-px bg-gradient-to-r from-teal-200 via-violet-200 to-green-200 z-0" />

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-4 relative">
              {pipelineSteps.map(({ icon: Icon, key, color, bg, border }) => (
                <motion.div key={key} variants={fadeUp} className="flex flex-col items-center text-center">
                  <div className={`relative z-10 flex items-center justify-center w-20 h-20 rounded-2xl ${bg} border ${border} shadow-sm mb-4`}>
                    <Icon className={`w-9 h-9 ${color}`} />
                  </div>
                  <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">
                    {t('ai.pipe.' + key + '.label')}
                  </div>
                  <div className="text-sm font-bold text-slate-800 mb-2">{t('ai.pipe.' + key + '.title')}</div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-full border border-stone-200 text-xs text-stone-500">
                    <Clock className="w-3 h-3 flex-shrink-0" />{t('ai.pipe.' + key + '.time')}
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>

          {/* Bottom callout */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="mt-14 text-center">
            <div className="inline-flex items-center gap-3 bg-white border border-stone-200 rounded-2xl px-6 py-4 shadow-sm">
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse flex-shrink-0" />
              <span className="text-stone-600 font-medium text-sm">{t('ai.pipeline.footer')}</span>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── HOW IT WORKS — dark gradient ────────────────────────────── */}
      <section id="how-it-works" className="bg-gradient-to-br from-slate-900 via-[#0f172a] to-indigo-950 py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <AnimatedSection className="text-center mb-16">
            <motion.span variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />{t('ai.how.badge')}
            </motion.span>
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              {t('ai.how.title')}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-2xl mx-auto">
              {t('ai.how.subtitle')}
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howSteps.map(({ icon: Icon, key, accent, num }, i) => (
              <motion.div key={key} variants={fadeUp} className="relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-slate-700 to-transparent -translate-x-8 z-0" />
                )}
                <div className="relative z-10 p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <Icon className={`w-8 h-8 ${accent}`} />
                    <span className={`text-5xl font-black ${accent} opacity-20 leading-none select-none`}>{num}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{t('ai.how.' + key + '.title')}</h3>
                  <p className="text-slate-400 leading-relaxed text-sm">{t('ai.how.' + key + '.desc')}</p>
                </div>
              </motion.div>
            ))}
          </AnimatedSection>

        </div>
      </section>

      {/* ── RESULTS — white ─────────────────────────────────────────── */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <AnimatedSection className="text-center mb-16">
            <motion.span variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium mb-4">
              <Shield className="w-4 h-4" />{t('ai.results.badge')}
            </motion.span>
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t('ai.results.title')}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-stone-500 max-w-2xl mx-auto">
              {t('ai.results.subtitle')}
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {results.map(({ key, icon: Icon, color, bg }) => (
              <motion.div key={key} variants={fadeUp}
                className="group p-8 rounded-2xl border border-stone-100 bg-white text-center hover:shadow-xl hover:shadow-stone-100/80 hover:-translate-y-1 transition-all duration-300">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${bg} mb-5 ${color} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-7 h-7" />
                </div>
                <div className="text-4xl font-black text-slate-900 mb-1">{t('ai.' + key + '.value')}</div>
                <div className="text-base font-semibold text-slate-700 mb-2">{t('ai.' + key + '.label')}</div>
                <div className="text-sm text-stone-500 leading-relaxed">{t('ai.' + key + '.desc')}</div>
              </motion.div>
            ))}
          </AnimatedSection>

          {/* Trust strip */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            className="mt-16 pt-10 border-t border-stone-100 text-center">
            <p className="text-stone-400 text-sm mb-6">{t('ai.trust.label')}</p>
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-40">
              {['TechCorp', 'StartupAI', 'GlobalHR', 'ScaleUp', 'TalentFirst'].map((name) => (
                <span key={name} className="text-stone-600 font-bold text-sm tracking-widest uppercase">{name}</span>
              ))}
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <CTASection />

    </main>
  );
}
