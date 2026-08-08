'use client';

import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import {
  Shield, Users, Network, BarChart3, Zap, Server,
  ArrowRight, CheckCircle2, Clock, Headphones, Lock,
  Building2, Globe, Star, Award, PhoneCall,
  ChevronRight, Sparkles, MessageSquare, CalendarDays,
  Rocket, Target, X
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

function AnimatedCounter({ value }: { value: string }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const raw = parseFloat(value.replace(/[^0-9.]/g, ''));
  const isLt = value.startsWith('<');

  useEffect(() => {
    if (!inView || isNaN(raw)) { setDisplay(value); return; }
    const duration = 1400;
    const step = (ts: number, origin: number) => {
      const prog = Math.min((ts - origin) / duration, 1);
      const eased = 1 - Math.pow(1 - prog, 3);
      const cur = Math.round(eased * raw);
      const fmt = raw >= 1000 ? cur.toLocaleString() : cur.toString();
      setDisplay((isLt ? '< ' : '') + fmt);
      if (prog < 1) requestAnimationFrame(ts2 => step(ts2, origin));
      else setDisplay(value);
    };
    requestAnimationFrame(ts => step(ts, ts));
  }, [inView, raw, isLt, value]);

  return <span ref={ref}>{display}</span>;
}

export default function EnterprisePage() {
  const { t } = useLocale();
  const [monthlyHires, setMonthlyHires] = useState(50);
  const [recruiterRate, setRecruiterRate] = useState(75);

  const hoursSaved = Math.round(monthlyHires * 2.5);
  const costSaved = hoursSaved * recruiterRate;

  const featureIcons = [Shield, Users, Network, BarChart3, Zap, Server];
  const featureGradients = [
    'from-emerald-500 to-teal-500',
    'from-brand-500 to-cyan-500',
    'from-violet-500 to-purple-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-sky-500 to-indigo-500',
  ];
  const secIcons = [Award, Lock, Globe, Building2, Users, Server];
  const logos = ['Next.js', 'React', 'TypeScript', 'Prisma', 'Tailwind CSS', 'PostgreSQL', 'OpenAI', 'Vercel'];
  const logosDoubled = [...logos, ...logos];

  const processIcons = [MessageSquare, CalendarDays, Rocket, Target];
  const processStyles = [
    { text: 'text-teal-600', lightText: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', numBg: 'bg-teal-50' },
    { text: 'text-brand-600', lightText: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200', numBg: 'bg-brand-50' },
    { text: 'text-violet-600', lightText: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', numBg: 'bg-violet-50' },
    { text: 'text-amber-600', lightText: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', numBg: 'bg-amber-50' },
  ];

  const compareFeatureKeys = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
  const compareData = [
    { us: true, basic: false, sheets: false },
    { us: true, basic: true, sheets: false },
    { us: true, basic: false, sheets: false },
    { us: true, basic: true, sheets: false },
    { us: true, basic: false, sheets: false },
    { us: true, basic: false, sheets: false },
  ];

  return (
    <main className="overflow-hidden">

      {/* ── HERO ── dark navy */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 pt-20 sm:pt-28 pb-14 sm:pb-24 bg-slate-950">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-brand-500/8 rounded-full blur-[100px] pointer-events-none" />
        <motion.div animate={{ y: [-8, 8, -8], x: [-4, 4, -4] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 right-16 w-3 h-3 rounded-full bg-teal-400/40 blur-sm hidden lg:block pointer-events-none" />
        <motion.div animate={{ y: [6, -6, 6], x: [3, -3, 3] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/3 left-20 w-2 h-2 rounded-full bg-brand-400/40 blur-sm hidden lg:block pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-sm font-medium mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              {t('enterprise.hero.badge')}
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6 text-white">
              {t('enterprise.hero.title')}{' '}
              <span className="bg-gradient-to-r from-teal-400 via-brand-400 to-cyan-400 bg-clip-text text-transparent">
                {t('enterprise.hero.titleHighlight')}
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t('enterprise.hero.desc')}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-10 sm:mb-20">
              <Link href="/contact" className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-brand-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-teal-500/25">
                {t('enterprise.hero.cta1')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/features" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 text-white/80 font-semibold text-sm hover:border-white/40 hover:text-white transition-colors backdrop-blur-sm">
                {t('enterprise.hero.cta2')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10">
              {[1,2,3,4].map(n => (
                <motion.div key={n} variants={scaleIn} className="bg-white/[0.05] px-3 py-5 sm:px-6 sm:py-6 text-center hover:bg-white/[0.09] transition-colors">
                  <div className="text-3xl font-black text-white mb-1">
                    <AnimatedCounter value={t(`enterprise.stat${n}`)} />
                  </div>
                  <div className="text-xs text-white/45 uppercase tracking-widest">{t(`enterprise.stat${n}.label`)}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── TRUSTED BY MARQUEE ── white */}
      <section className="py-12 border-y border-stone-200 overflow-hidden bg-white">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400 font-medium">{t('enterprise.trusted')}</p>
        </div>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          <div className="flex gap-14 animate-[marquee_22s_linear_infinite]">
            {logosDoubled.map((logo, i) => (
              <div key={i} className="flex-shrink-0 px-6 py-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-500 text-sm font-semibold whitespace-nowrap hover:text-slate-900 hover:border-stone-300 hover:bg-white transition-all">
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES BENTO ── white */}
      <section className="py-16 sm:py-24 lg:py-28 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-200 bg-brand-50 text-brand-700 text-xs font-semibold uppercase tracking-widest mb-4">
              {t('enterprise.features.badge')}
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">{t('enterprise.features.title')}</motion.h2>
            <motion.p variants={fadeUp} className="text-stone-500 max-w-2xl mx-auto">{t('enterprise.features.subtitle')}</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featureIcons.map((Icon, i) => (
              <motion.div key={i} variants={scaleIn} whileHover={{ y: -4, scale: 1.01 }} transition={{ type: 'spring', stiffness: 300 }}
                className="group relative p-7 rounded-2xl border border-stone-200 bg-white shadow-sm hover:shadow-md overflow-hidden transition-all">
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity bg-gradient-to-br ${featureGradients[i]} pointer-events-none`} />
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${featureGradients[i]} mb-5 shadow-md`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">{t(`enterprise.f${i + 1}.title`)}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{t(`enterprise.f${i + 1}.desc`)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PROCESS TIMELINE ── stone-50 */}
      <section className="py-16 sm:py-24 lg:py-28 px-4 sm:px-6 bg-stone-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgb(0,0,0,0.04)_1px,_transparent_0)] bg-[size:32px_32px] pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold uppercase tracking-widest mb-4">
              {t('enterprise.process.badge')}
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">{t('enterprise.process.title')}</motion.h2>
            <motion.p variants={fadeUp} className="text-stone-500 max-w-2xl mx-auto">{t('enterprise.process.subtitle')}</motion.p>
          </motion.div>
          <div className="relative">
            <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-8 bottom-8 w-px bg-gradient-to-b from-teal-300 via-violet-200 to-amber-200" />
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {processIcons.map((Icon, i) => (
                <motion.div key={i} variants={fadeUp} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300 }}
                  className={`relative group p-7 rounded-2xl border ${processStyles[i].border} bg-white shadow-sm hover:shadow-md transition-all overflow-hidden`}>
                  <div className={`absolute top-0 right-0 w-12 h-12 ${processStyles[i].bg} flex items-end justify-start rounded-bl-2xl rounded-tr-2xl`}>
                    <span className={`text-xs font-black pl-2 pb-1.5 ${processStyles[i].text}`}>0{i + 1}</span>
                  </div>
                  <div className={`inline-flex p-3 rounded-xl ${processStyles[i].bg} border ${processStyles[i].border} mb-5`}>
                    <Icon className={`w-5 h-5 ${processStyles[i].text}`} />
                  </div>
                  <div className={`text-xs font-bold uppercase tracking-widest ${processStyles[i].text} mb-2`}>
                    {t(`enterprise.process.s${i + 1}.step`)}
                  </div>
                  <h3 className="text-slate-900 font-bold text-xl mb-2">{t(`enterprise.process.s${i + 1}.title`)}</h3>
                  <p className="text-stone-500 text-sm leading-relaxed">{t(`enterprise.process.s${i + 1}.desc`)}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS + ROI ── white */}
      <section className="py-16 sm:py-24 lg:py-28 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold uppercase tracking-widest mb-4">
              {t('enterprise.benefits.badge')}
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">{t('enterprise.benefits.title')}</motion.h2>
            <motion.p variants={fadeUp} className="text-stone-500 max-w-2xl mx-auto">{t('enterprise.benefits.subtitle')}</motion.p>
          </motion.div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-2.5">
              {Array.from({ length: 10 }, (_, i) => (
                <motion.div key={i} variants={fadeUp} className="flex items-start gap-3 p-4 rounded-xl border border-stone-200 bg-stone-50 hover:bg-teal-50/60 hover:border-teal-200 transition-all group">
                  <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-teal-600" />
                  </div>
                  <span className="text-stone-700 text-sm group-hover:text-slate-900 transition-colors">{t(`enterprise.b${i + 1}`)}</span>
                </motion.div>
              ))}
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn}
              className="relative p-8 rounded-2xl border border-stone-200 bg-white shadow-lg overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-teal-50 rounded-full blur-[60px] pointer-events-none" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold uppercase tracking-widest mb-4">
                  {t('enterprise.roi.badge')}
                </div>
                <h3 className="text-2xl font-black mb-1 text-slate-900">{t('enterprise.roi.title')}</h3>
                <p className="text-stone-500 text-sm mb-7">{t('enterprise.roi.subtitle')}</p>
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-stone-600">{t('enterprise.roi.hiresLabel')}</span>
                    <span className="text-teal-600 font-bold">{monthlyHires}</span>
                  </div>
                  <input type="range" min={1} max={500} value={monthlyHires} onChange={e => setMonthlyHires(+e.target.value)}
                    className="w-full accent-teal-500 h-1.5 rounded-full" />
                  <p className="text-xs text-stone-400 mt-1">{t('enterprise.roi.hiresHint')}</p>
                </div>
                <div className="mb-8">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-stone-600">{t('enterprise.roi.rateLabel')}</span>
                    <span className="text-teal-600 font-bold">${recruiterRate}</span>
                  </div>
                  <input type="range" min={20} max={200} value={recruiterRate} onChange={e => setRecruiterRate(+e.target.value)}
                    className="w-full accent-teal-500 h-1.5 rounded-full" />
                  <p className="text-xs text-stone-400 mt-1">{t('enterprise.roi.rateHint')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-teal-200 bg-teal-50 text-center">
                    <div className="text-3xl font-black text-teal-600 mb-1">{hoursSaved.toLocaleString()}</div>
                    <div className="text-xs text-stone-500">{t('enterprise.roi.hoursSaved')}</div>
                  </div>
                  <div className="p-4 rounded-xl border border-brand-200 bg-brand-50 text-center">
                    <div className="text-3xl font-black text-brand-600 mb-1">${costSaved.toLocaleString()}</div>
                    <div className="text-xs text-stone-500">{t('enterprise.roi.costSaved')}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── SECURITY GRID ── white */}
      <section className="py-16 sm:py-24 lg:py-28 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-widest mb-4">
              {t('enterprise.security.badge')}
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">{t('enterprise.security.title')}</motion.h2>
            <motion.p variants={fadeUp} className="text-stone-500 max-w-2xl mx-auto">{t('enterprise.security.subtitle')}</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {secIcons.map((Icon, i) => (
              <motion.div key={i} variants={fadeUp}
                className="group flex items-start gap-4 p-6 rounded-2xl border border-stone-200 bg-white shadow-sm hover:bg-emerald-50/60 hover:border-emerald-200 hover:shadow-md transition-all">
                <div className="flex-shrink-0 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 group-hover:bg-emerald-100 transition-colors">
                  <Icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">{t(`enterprise.sec${i + 1}.title`)}</h3>
                  <p className="text-stone-500 text-sm leading-relaxed">{t(`enterprise.sec${i + 1}.desc`)}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── slate-50 */}
      <section className="py-16 sm:py-24 lg:py-28 px-4 sm:px-6 bg-slate-50 relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="text-center mb-14">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold uppercase tracking-widest mb-4">
              {t('enterprise.compare.badge')}
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">{t('enterprise.compare.title')}</motion.h2>
            <motion.p variants={fadeUp} className="text-stone-500 max-w-2xl mx-auto">{t('enterprise.compare.subtitle')}</motion.p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="rounded-2xl border border-stone-200 overflow-hidden shadow-lg bg-white">
            <div className="overflow-x-auto">
            <div className="min-w-[500px]">
            {/* Header */}
            <div className="grid grid-cols-4 bg-stone-100 border-b border-stone-200">
              <div className="p-5 text-xs text-stone-400 uppercase tracking-widest font-semibold">{t('enterprise.compare.feature')}</div>
              <div className="p-5 text-center border-l border-stone-200 bg-teal-50/70">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-teal-500/15 to-brand-500/15 border border-teal-300">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span className="text-xs font-black text-slate-900">{t('enterprise.compare.us')}</span>
                </div>
              </div>
              <div className="p-5 text-center border-l border-stone-200">
                <span className="text-xs font-semibold text-stone-400">{t('enterprise.compare.basic')}</span>
              </div>
              <div className="p-5 text-center border-l border-stone-200">
                <span className="text-xs font-semibold text-stone-400">{t('enterprise.compare.sheets')}</span>
              </div>
            </div>
            {/* Feature Rows */}
            {compareFeatureKeys.map((key, i) => (
              <div key={key} className={`grid grid-cols-4 border-t border-stone-100 ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'} hover:bg-teal-50/30 transition-colors group`}>
                <div className="p-5 text-sm text-stone-700 group-hover:text-slate-900 transition-colors font-medium">
                  {t(`enterprise.compare.${key}`)}
                </div>
                <div className="p-5 flex items-center justify-center border-l border-stone-100 bg-teal-50/30">
                  {compareData[i].us
                    ? <CheckCircle2 className="w-5 h-5 text-teal-500" />
                    : <X className="w-4 h-4 text-stone-300" />}
                </div>
                <div className="p-5 flex items-center justify-center border-l border-stone-100">
                  {compareData[i].basic
                    ? <CheckCircle2 className="w-5 h-5 text-stone-400" />
                    : <X className="w-4 h-4 text-stone-300" />}
                </div>
                <div className="p-5 flex items-center justify-center border-l border-stone-100">
                  {compareData[i].sheets
                    ? <CheckCircle2 className="w-5 h-5 text-stone-400" />
                    : <X className="w-4 h-4 text-stone-300" />}
                </div>
              </div>
            ))}
            </div>{/* /min-w */}
            </div>{/* /overflow-x-auto */}
          </motion.div>
        </div>
      </section>

      {/* ── SUPPORT / CSM ── dark brand gradient */}
      <section className="py-16 sm:py-24 lg:py-28 px-4 sm:px-6 bg-gradient-to-br from-slate-900 via-[#0f172a] to-indigo-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-6">
                {t('enterprise.support.badge')}
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight mb-5 text-white">{t('enterprise.support.title')}</motion.h2>
              <motion.p variants={fadeUp} className="text-white/60 leading-relaxed mb-8">{t('enterprise.support.desc')}</motion.p>
              <motion.ul variants={stagger} className="space-y-3">
                {[1,2,3,4].map(n => (
                  <motion.li key={n} variants={fadeUp} className="flex items-center gap-3 text-white/75 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    {t(`enterprise.support.c${n}`)}
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-4">
              {[
                { icon: Clock, label: t('enterprise.support.hours'), sub: 'Dedicated Support', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                { icon: Star, label: t('enterprise.support.nps'), sub: 'Satisfaction Score', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { icon: Headphones, label: t('enterprise.support.time'), sub: 'Response Time', color: 'text-teal-400', bg: 'bg-teal-500/10' },
              ].map((card, i) => (
                <motion.div key={i} variants={scaleIn}
                  className="flex items-center gap-5 p-5 rounded-2xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] transition-colors backdrop-blur-sm">
                  <div className={`p-3 rounded-xl ${card.bg}`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <div>
                    <div className={`text-2xl font-black ${card.color}`}>{card.label}</div>
                    <div className="text-white/45 text-xs uppercase tracking-wider">{card.sub}</div>
                  </div>
                </motion.div>
              ))}
              <motion.div variants={fadeUp} className="p-5 rounded-2xl border border-brand-400/25 bg-gradient-to-br from-brand-500/10 to-teal-500/5">
                <div className="flex items-center gap-3 mb-3">
                  <PhoneCall className="w-5 h-5 text-brand-400" />
                  <span className="font-semibold text-white text-sm">{t('enterprise.support.ctaLabel')}</span>
                </div>
                <Link href="/contact" className="inline-flex items-center gap-2 text-brand-300 text-sm font-semibold hover:text-brand-200 transition-colors">
                  {t('enterprise.hero.cta1')} <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <CTASection
        title={t('enterprise.cta.title')}
        subtitle={t('enterprise.cta.subtitle')}
      />
    </main>
  );
}
