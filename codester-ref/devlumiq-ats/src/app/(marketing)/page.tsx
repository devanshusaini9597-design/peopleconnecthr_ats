'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BarChart3, Users, Briefcase, Building2, Shield, Zap, LayoutDashboard,
  Upload, Search, UserCheck, ArrowRight, GripVertical,
  Calendar, Mail, MessageSquare, Globe, Layers, CheckCircle2,
  Star, Linkedin, Twitter, Github, ExternalLink,
  ArrowUpRight, FileText, Clock, TrendingUp, Award, HeadphonesIcon, ChevronDown, Code,
} from 'lucide-react';
import HeroDashboardPreview from '@/components/HeroDashboardPreview';
import Logo from '@/components/Logo';
import StatsSection from '@/components/sections/StatsSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import CTASection from '@/components/sections/CTASection';
import SectionHeading from '@/components/ui/SectionHeading';
import { useLocale } from '@/components/providers/LocaleProvider';

const bentoFeatures = [
  { icon: Users, titleKey: 'home.bento1Title', descKey: 'home.bento1Desc', span: 'col-span-1 row-span-1', gradient: 'from-brand-500/20 to-teal-500/20', iconBg: 'from-brand-500 to-teal-600' },
  { icon: BarChart3, titleKey: 'home.bento2Title', descKey: 'home.bento2Desc', span: 'col-span-1 row-span-2', gradient: 'from-amber-500/15 to-orange-500/15', iconBg: 'from-amber-500 to-orange-600' },
  { icon: Calendar, titleKey: 'home.bento3Title', descKey: 'home.bento3Desc', span: 'col-span-1 row-span-1', gradient: 'from-violet-500/20 to-purple-500/20', iconBg: 'from-violet-500 to-purple-600' },
  { icon: Mail, titleKey: 'home.bento4Title', descKey: 'home.bento4Desc', span: 'col-span-1 row-span-1', gradient: 'from-emerald-500/20 to-teal-500/20', iconBg: 'from-emerald-500 to-teal-600' },
  { icon: MessageSquare, titleKey: 'home.bento5Title', descKey: 'home.bento5Desc', span: 'col-span-1 row-span-1', gradient: 'from-cyan-500/20 to-blue-500/20', iconBg: 'from-cyan-500 to-blue-600' },
  { icon: GripVertical, titleKey: 'home.bento6Title', descKey: 'home.bento6Desc', span: 'col-span-2 row-span-1', gradient: 'from-stone-500/10 to-stone-600/10', iconBg: 'from-stone-600 to-stone-700' },
  { icon: Globe, titleKey: 'home.bento7Title', descKey: 'home.bento7Desc', span: 'col-span-1 row-span-1', gradient: 'from-rose-500/20 to-pink-500/20', iconBg: 'from-rose-500 to-pink-600' },
  { icon: Layers, titleKey: 'home.bento8Title', descKey: 'home.bento8Desc', span: 'col-span-1 row-span-1', gradient: 'from-brand-500/20 to-cyan-500/20', iconBg: 'from-brand-500 to-cyan-600' },
];

const stepKeys = [
  { icon: Upload, titleKey: 'home.step1Title', descKey: 'home.step1Desc' },
  { icon: Search, titleKey: 'home.step2Title', descKey: 'home.step2Desc' },
  { icon: UserCheck, titleKey: 'home.step3Title', descKey: 'home.step3Desc' },
];



const logos = ['Next.js', 'React', 'TypeScript', 'Prisma', 'Tailwind CSS', 'Framer Motion', 'PostgreSQL', 'OpenAI'];

const benefitKeys = [
  { icon: Clock, titleKey: 'home.save40Time', descKey: 'home.save40Desc' },
  { icon: TrendingUp, titleKey: 'home.hireFaster', descKey: 'home.hireFasterDesc' },
  { icon: Award, titleKey: 'home.betterCandidates', descKey: 'home.betterCandidatesDesc' },
  { icon: HeadphonesIcon, titleKey: 'home.support24', descKey: 'home.support24Desc' },
];

const deepDiveKeys = [
  { titleKey: 'home.deep1Title', descKey: 'home.deep1Desc', featureKeys: ['home.deep1F1', 'home.deep1F2', 'home.deep1F3', 'home.deep1F4'], image: 'search' },
  { titleKey: 'home.deep2Title', descKey: 'home.deep2Desc', featureKeys: ['home.deep2F1', 'home.deep2F2', 'home.deep2F3', 'home.deep2F4'], image: 'workflow' },
  { titleKey: 'home.deep3Title', descKey: 'home.deep3Desc', featureKeys: ['home.deep3F1', 'home.deep3F2', 'home.deep3F3', 'home.deep3F4'], image: 'analytics' },
];

const integrations = [
  { name: 'LinkedIn', icon: Linkedin, connected: true, iconBg: 'bg-blue-100', iconColor: 'text-blue-700' },
  { name: 'Slack', icon: MessageSquare, connected: false, iconBg: 'bg-violet-100', iconColor: 'text-violet-700' },
  { name: 'Google Calendar', icon: Calendar, connected: false, iconBg: 'bg-red-50', iconColor: 'text-red-500' },
  { name: 'Outlook', icon: Mail, connected: false, iconBg: 'bg-sky-50', iconColor: 'text-sky-600' },
  { name: 'Zapier', icon: Zap, connected: true, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
  { name: 'Checkr', icon: Shield, connected: true, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

function FAQAccordion() {
  const { t } = useLocale();
  const [open, setOpen] = useState<number | null>(null);
  const faqItems = Array.from({ length: 8 }, (_, i) => ({
    q: t(`home.faq${i + 1}q`),
    a: t(`home.faq${i + 1}a`),
  }));
  const half = Math.ceil(faqItems.length / 2);
  const renderItem = (faq: typeof faqItems[0], i: number) => (
    <motion.div
      key={i}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: (i % half) * 0.06 }}
      className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
        open === i
          ? 'border-brand-200/80 bg-gradient-to-br from-brand-50/50 to-white shadow-[0_2px_20px_-4px_rgba(13,148,136,0.12)]'
          : 'border-stone-200/70 bg-white hover:border-brand-100 hover:shadow-sm'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(open === i ? null : i)}
        className="w-full flex items-center gap-3.5 px-5 py-4 text-left"
      >
        <span className={`flex-shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] font-extrabold transition-colors duration-200 ${
          open === i ? 'bg-brand-100 border-brand-200 text-brand-700' : 'bg-stone-100 border-stone-200 text-stone-400'
        }`}>
          {String(i + 1).padStart(2, '0')}
        </span>
        <span className={`font-semibold text-sm flex-1 min-w-0 ${
          open === i ? 'text-brand-800' : 'text-stone-900'
        }`}>{faq.q}</span>
        <motion.div
          animate={{ rotate: open === i ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
            open === i ? 'bg-brand-100' : 'bg-stone-100'
          }`}
        >
          <ChevronDown className={`w-3.5 h-3.5 ${open === i ? 'text-brand-600' : 'text-stone-400'}`} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open === i && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="pl-[3.75rem] pr-5 pb-5 text-sm text-stone-600 leading-relaxed border-t border-brand-100/60 pt-3.5">
              {faq.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="space-y-3">
        {faqItems.slice(0, half).map((faq, i) => renderItem(faq, i))}
      </div>
      <div className="space-y-3">
        {faqItems.slice(half).map((faq, i) => renderItem(faq, half + i))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { t } = useLocale();
  const stepBullets = [
    [t('home.sb1.1'), t('home.sb1.2'), t('home.sb1.3')],
    [t('home.sb2.1'), t('home.sb2.2'), t('home.sb2.3')],
    [t('home.sb3.1'), t('home.sb3.2'), t('home.sb3.3')],
  ];
  return (
    <>
      {/* --- Section: Home Hero - start --- */}
      <HeroDashboardPreview />
      {/* --- Section: Home Hero - end --- */}

      {/* --- Section: Stats - start --- */}
      <StatsSection />
      {/* --- Section: Stats - end --- */}

      {/* --- Section: Awards / Social Proof - start --- */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8 bg-white border-b border-stone-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Built With</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5 justify-items-center">
            {[
              { label: 'Next.js 15', sub: 'App Router · RSC', color: 'from-stone-700 to-stone-900', badge: 'Framework' },
              { label: 'TypeScript', sub: 'Type-safe by default', color: 'from-blue-500 to-indigo-500', badge: 'Language' },
              { label: 'Tailwind CSS', sub: 'Utility-first styling', color: 'from-cyan-500 to-teal-500', badge: 'Styling' },
              { label: 'Prisma ORM', sub: 'PostgreSQL-backed', color: 'from-emerald-500 to-teal-600', badge: 'Database' },
            ].map((award) => (
              <motion.div
                key={award.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                whileHover={{ y: -3, scale: 1.04 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-2 px-5 py-4 rounded-2xl border border-stone-200/80 bg-white shadow-sm hover:shadow-md hover:border-brand-200/60 transition-all"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${award.color} flex items-center justify-center shadow-md`}>
                  <Code className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-extrabold text-stone-900">{award.label}</p>
                <p className="text-[11px] text-stone-500 font-medium">{award.sub}</p>
                <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-100">{award.badge}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* --- Section: Awards / Social Proof - end --- */}

      {/* --- Section: Logo Cloud - start --- */}
      {/* Logo Cloud - Trusted by */}
      <section className="py-12 sm:py-16 bg-gradient-to-b from-stone-50 to-white border-y border-stone-100 overflow-hidden">
        <div className="mb-8 text-center px-4">
          <SectionHeading icon={Building2} title={t('home.trustedBy')} />
        </div>
        {/* Marquee container */}
        <div className="relative overflow-hidden">
          {/* fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-28 z-10 bg-gradient-to-r from-stone-50 to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-28 z-10 bg-gradient-to-l from-stone-50 to-transparent pointer-events-none" />
          <div className="flex gap-5 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            {/* Row 1 scrolling left */}
            <motion.div
              animate={{ x: [0, '-50%'] }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              className="flex gap-5 flex-shrink-0"
            >
              {[...logos, ...logos].map((logo, i) => (
                <div
                  key={`${logo}-${i}`}
                  className="flex-shrink-0 text-sm sm:text-base font-bold text-stone-500 hover:text-brand-600 transition-colors duration-300 cursor-default px-5 py-3 rounded-xl border border-stone-200/70 bg-white shadow-sm hover:border-brand-200 hover:bg-brand-50/30 whitespace-nowrap"
                >
                  {logo}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
      {/* --- Section: Logo Cloud - end --- */}

      {/* Dashboard Preview */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-stone-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <SectionHeading icon={LayoutDashboard} title="Dashboard Preview" subtitle="A quick look at the Devlumiq ATS interface." />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/20 border border-stone-200/80 bg-white"
          >
            <Image
              src="/images/website-dashboard-preview.png"
              alt="Devlumiq ATS Dashboard"
              width={1600}
              height={900}
              className="w-full h-auto"
              priority
            />
          </motion.div>
        </div>
      </section>

      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <SectionHeading icon={TrendingUp} title={t('home.builtForModern')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefitKeys.map((benefit, i) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.titleKey}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="p-6 rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)] hover:border-brand-200/80 hover:shadow-[var(--shadow-elevated)] transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center mb-4 shadow-[var(--shadow-card)]">
                    <Icon className="w-6 h-6 text-brand-600" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 mb-2">{t(benefit.titleKey)}</h3>
                  <p className="text-sm text-stone-600">{t(benefit.descKey)}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
      {/* --- Section: Benefits - end --- */}

      {/* --- Section: Bento Features - start --- */}
      {/* Bento Features — grid (mobile-optimized) */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 lg:px-8 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14 px-1">
            <SectionHeading icon={LayoutDashboard} title={t('home.recruitmentSuite')} subtitle={t('home.recruitmentSuiteDesc')} />
          </div>

          {/* Mobile: single-column stacked cards — full width, no truncation */}
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 min-w-0 lg:[grid-auto-rows:minmax(160px,auto)]"
          >
            {bentoFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.titleKey}
                  variants={item}
                  whileHover={{ y: -4, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } }}
                  className={`group relative overflow-visible rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] hover:border-brand-200/80 transition-all duration-300
                    sm:col-span-1 sm:row-span-1
                    ${f.span.includes('col-span-2') ? 'lg:col-span-2' : ''}
                    ${f.span.includes('row-span-2') ? 'lg:row-span-2' : ''}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`} />
                  {/* Mobile: horizontal layout (icon + text) — avoids truncation */}
                  <div className="relative flex sm:flex-col items-start gap-3 sm:gap-0 p-4 sm:p-6 min-h-0">
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${f.iconBg} flex items-center justify-center flex-shrink-0 shadow-[var(--shadow-card)] group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 sm:mt-4">
                      <h3 className="text-base sm:text-lg font-bold text-stone-900 mb-0.5 sm:mb-1 break-words">{t(f.titleKey)}</h3>
                      <p className="text-sm text-stone-600 leading-relaxed break-words">{t(f.descKey)}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
          <div className="text-center mt-10">
            <Link href="/features">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
              >
                {t('home.viewAllFeatures')} <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </div>
        </div>
      </section>

      {/* --- Section: Deep Dive - start --- */}
      {/* Deep Dive Features - Power features (theme-designed) */}
      <section className="py-16 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle theme gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/30 via-white to-teal-50/20 pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-12 sm:mb-16">
            <SectionHeading icon={Zap} title={t('home.powerFeatures')} subtitle={t('home.powerFeaturesDesc')} />
          </div>

          <div className="space-y-16 sm:space-y-20 lg:space-y-24">
            {deepDiveKeys.map((feature, i) => {
              const accent = i === 0 ? 'brand' : i === 1 ? 'warm' : 'teal';
              const gradientMap = { brand: 'from-brand-500 to-teal-600', warm: 'from-warm-500 to-amber-600', teal: 'from-teal-500 to-cyan-600' };
              const bgMap = { brand: 'bg-brand-50', warm: 'bg-warm-50', teal: 'bg-teal-50/80' };
              return (
                <motion.div
                  key={feature.titleKey}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.35, delay: i * 0.08 }}
                  className={`flex flex-col ${i % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-6 sm:gap-8 lg:gap-16 items-center`}
                >
                  <div className="flex-1 w-full min-w-0">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientMap[accent]} flex items-center justify-center flex-shrink-0 shadow-[var(--shadow-card)] mb-4`}>
                      {feature.image === 'search' && <Search className="w-6 h-6 text-white" />}
                      {feature.image === 'workflow' && <Zap className="w-6 h-6 text-white" />}
                      {feature.image === 'analytics' && <BarChart3 className="w-6 h-6 text-white" />}
                    </div>
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-stone-900 mb-3 sm:mb-4">
                      {t(feature.titleKey)}
                    </h3>
                    <p className="text-base sm:text-lg text-stone-600 mb-4 sm:mb-6 leading-relaxed">
                      {t(feature.descKey)}
                    </p>
                    <ul className="space-y-2.5 sm:space-y-3">
                      {feature.featureKeys.map((key) => (
                        <li key={key} className="flex items-center gap-3 text-stone-700">
                          <span className={`flex-shrink-0 w-6 h-6 rounded-full ${accent === 'brand' ? 'bg-brand-100' : accent === 'warm' ? 'bg-warm-100' : 'bg-teal-100'} flex items-center justify-center`}>
                            <CheckCircle2 className={`w-3.5 h-3.5 ${accent === 'brand' ? 'text-brand-600' : accent === 'warm' ? 'text-warm-600' : 'text-teal-600'}`} />
                          </span>
                          <span>{t(key)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="flex-1 w-full max-w-md mx-auto"
                  >
                    <div className={`rounded-2xl border-2 overflow-hidden
                      ${accent === 'brand' ? 'border-brand-200/80 bg-gradient-to-br from-brand-50 to-white' : accent === 'warm' ? 'border-warm-200/80 bg-gradient-to-br from-warm-50 to-white' : 'border-teal-200/80 bg-gradient-to-br from-teal-50 to-white'}
                      shadow-[var(--shadow-elevated)]`}
                    >
                      {feature.image === 'search' && (
                        <Image
                          src="/images/website-candidates-search-preview.png"
                          alt="Smart candidate screening"
                          width={800}
                          height={500}
                          className="w-full h-auto"
                        />
                      )}
                      {feature.image === 'workflow' && (
                        <Image
                          src="/images/website-pipeline-preview.png"
                          alt="Kanban pipeline board"
                          width={800}
                          height={500}
                          className="w-full h-auto"
                        />
                      )}
                      {feature.image === 'analytics' && (
                        <Image
                          src="/images/webite-analytics-preview.png"
                          alt="Analytics dashboard"
                          width={800}
                          height={500}
                          className="w-full h-auto"
                        />
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
      {/* --- Section: Deep Dive - end --- */}

      {/* --- Section: Integrations - start --- */}
      {/* Integrations */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <SectionHeading icon={Globe} title={t('home.connectTools')} subtitle={t('home.connectToolsDesc')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration, i) => {
              const Icon = integration.icon;
              return (
                <motion.div
                  key={integration.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -2 }}
                  className="flex items-center justify-between p-4 rounded-xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)] hover:border-brand-200/80 hover:shadow-[var(--shadow-elevated)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${integration.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${integration.iconColor}`} />
                    </div>
                    <span className="font-semibold text-stone-900">{integration.name}</span>
                  </div>
                  {integration.connected ? (
                    <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded-full">
                      {t('home.connected')}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-stone-600 bg-stone-100 px-2 py-1 rounded-full">
                      {t('home.comingSoon')}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
      {/* --- Section: Integrations - end --- */}

      {/* --- Section: How it works - start --- */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-stone-50 via-white to-stone-50 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% -5%, rgba(13,148,136,0.14), transparent 70%)' }} />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-16">
            <SectionHeading icon={UserCheck} title={t('home.howItWorks')} subtitle={t('home.howItWorksDesc')} />
          </div>
          <div className="relative">
            {/* Desktop connector line */}
            <div
              className="hidden md:block absolute top-[3.25rem] left-[calc(16.666%+2.5rem)] right-[calc(16.666%+2.5rem)] h-px z-0"
              aria-hidden
              style={{ background: 'linear-gradient(to right, transparent, rgba(13,148,136,0.35) 30%, rgba(13,148,136,0.35) 70%, transparent)' }}
            />
            {/* Connector dots */}
            <div className="hidden md:block absolute top-[3.1rem] left-[calc(33.333%-0.375rem)] w-2 h-2 rounded-full bg-brand-400/60 z-0" aria-hidden />
            <div className="hidden md:block absolute top-[3.1rem] right-[calc(33.333%-0.375rem)] w-2 h-2 rounded-full bg-brand-400/60 z-0" aria-hidden />

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
              {stepKeys.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.titleKey}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12, duration: 0.4 }}
                    className="group"
                  >
                    <div className="relative bg-white border border-stone-200/80 rounded-2xl p-6 sm:p-7 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] hover:border-brand-200/80 transition-all duration-300 h-full flex flex-col">
                      {/* Step badge */}
                      <span className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-[11px] font-extrabold text-brand-600">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {/* Icon */}
                      <motion.div
                        whileHover={{ scale: 1.08, rotate: i % 2 === 0 ? 4 : -4 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center mb-5 shadow-lg shadow-brand-500/20 ring-4 ring-brand-50 flex-shrink-0"
                      >
                        <Icon className="w-7 h-7 text-white" />
                      </motion.div>
                      <h3 className="text-lg font-bold text-stone-900 mb-2">{t(step.titleKey)}</h3>
                      <p className="text-sm text-stone-500 leading-relaxed mb-5">{t(step.descKey)}</p>
                      {/* Bullets */}
                      <ul className="space-y-2 mt-auto">
                        {stepBullets[i].map((bullet) => (
                          <li key={bullet} className="flex items-center gap-2 text-xs text-stone-600">
                            <span className="w-4 h-4 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5 text-brand-600" />
                            </span>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <TestimonialsSection />

      {/* --- Section: Blog / Resources Teaser - start --- */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <SectionHeading icon={FileText} title="Hiring insights & guides" subtitle="Tips, strategies, and deep-dives to help your team hire better." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                tag: 'Smart Hiring',
                tagColor: 'text-violet-600 bg-violet-50',
                title: 'How Smart Screening Speeds Up Shortlisting',
                excerpt: 'Explore how Devlumiq ATS can rank candidates with rule-based or optional OpenAI screening so recruiters focus on the best fits first.',
                readTime: '5 min read',
                gradient: 'from-violet-500/10 to-purple-500/5',
              },
              {
                tag: 'Best Practices',
                tagColor: 'text-brand-600 bg-brand-50',
                title: 'Hiring Metrics Worth Tracking in Your ATS',
                excerpt: 'From pipeline health to source visibility — learn which reports in Devlumiq ATS help your team improve recruiting over time.',
                readTime: '7 min read',
                gradient: 'from-brand-500/10 to-teal-500/5',
              },
              {
                tag: 'Product',
                tagColor: 'text-emerald-600 bg-emerald-50',
                title: 'Kanban Pipeline: Keep Every Candidate Visible',
                excerpt: 'See how the drag-and-drop Kanban board keeps stage changes in sync for your whole hiring team.',
                readTime: '4 min read',
                gradient: 'from-emerald-500/10 to-teal-500/5',
              },
            ].map((post, i) => (
              <motion.div
                key={post.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="group flex flex-col rounded-2xl border border-stone-200/80 bg-white overflow-hidden hover:border-brand-200/80 hover:shadow-[var(--shadow-elevated)] transition-all duration-300 shadow-[var(--shadow-card)]"
              >
                {/* Image placeholder with gradient */}
                <div className={`h-28 sm:h-36 bg-gradient-to-br ${post.gradient} border-b border-stone-100 flex items-center justify-center`}>
                  <FileText className="w-12 h-12 text-stone-300" />
                </div>
                <div className="flex flex-col flex-1 p-5">
                  <span className={`self-start px-2.5 py-0.5 rounded-full text-[11px] font-bold ${post.tagColor} mb-3`}>{post.tag}</span>
                  <h3 className="font-bold text-stone-900 text-base leading-snug mb-2 group-hover:text-brand-700 transition-colors">{post.title}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed flex-1">{post.excerpt}</p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-100">
                    <span className="text-xs text-stone-400">{post.readTime}</span>
                    <Link href="/resources" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group-hover:gap-2 transition-all">
                      Read more <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/resources">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-brand-600 border border-brand-200 hover:bg-brand-50 transition-colors"
              >
                View all articles <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </div>
        </div>
      </section>
      {/* --- Section: Blog / Resources Teaser - end --- */}

      {/* --- Section: Pricing Teaser - start --- */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-stone-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(13,148,136,0.1), transparent 70%)' }} />
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-14">
            <SectionHeading
              icon={TrendingUp}
              title="Choose your license"
              subtitle="Regular or Extended — one-time source-code license."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6">
            {[
              {
                name: 'License Regular',
                highlight: false,
                desc: 'Built for standard ATS workflows',
                features: ['Core ATS features', 'Team management', 'Candidate tracking', 'Email support'],
                cta: 'View Regular license',
                href: '/pricing',
              },
              {
                name: 'License Extended',
                highlight: true,
                desc: 'More tools for growing teams',
                features: ['Expanded automation', 'Advanced reporting', 'Additional integrations', 'Priority support'],
                cta: 'View Extended license',
                href: '/pricing',
              },
            ].map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className={`relative flex flex-col rounded-2xl border p-7 shadow-[var(--shadow-card)] transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-brand-600 to-teal-700 border-brand-500 shadow-brand-500/20 shadow-xl text-white'
                    : 'bg-white border-stone-200/80 hover:border-brand-200/80 hover:shadow-[var(--shadow-elevated)]'
                }`}
              >
                <div className="mb-5">
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${plan.highlight ? 'text-teal-200' : 'text-brand-500'}`}>
                    {plan.name}
                  </p>
                  <p className={`text-sm mt-1 ${plan.highlight ? 'text-teal-100' : 'text-stone-500'}`}>
                    {plan.desc}
                  </p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2.5 text-sm ${plan.highlight ? 'text-teal-50' : 'text-stone-600'}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? 'text-teal-300' : 'text-brand-500'}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href={plan.href}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                      plan.highlight
                        ? 'bg-white text-brand-700 hover:bg-teal-50 shadow-lg'
                        : 'bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-500/20'
                    }`}
                  >
                    {plan.cta}
                  </motion.button>
                </Link>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-sm text-stone-500 mt-8">
            Both license types are a <strong className="text-stone-700">one-time purchase</strong> with source code included.{' '}
            <Link href="/pricing" className="text-brand-600 font-semibold hover:underline">View license details →</Link>
          </p>
        </div>
      </section>
      {/* --- Section: Pricing Teaser - end --- */}

      {/* --- Section: Comparison Why Us - start --- */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <SectionHeading icon={Award} title="Why teams switch to Devlumiq ATS" subtitle="Built different from legacy ATS tools — faster, smarter, and actually enjoyable to use." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Left: Old ATS */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-6 sm:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-stone-200 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-stone-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-500">Legacy ATS</p>
                  <p className="text-xs text-stone-400">The old way</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Complex, outdated UI no one enjoys',
                  'Days of setup and onboarding',
                  'Manual data entry for everything',
                  'No smart screening or candidate ranking',
                  'Per-seat pricing adds up fast',
                  'Poor mobile experience',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-stone-500">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="w-2 h-0.5 bg-red-400 rounded-full block" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            {/* Right: Devlumiq ATS */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-brand-200/80 bg-gradient-to-b from-brand-50/60 to-white p-6 sm:p-8 shadow-[var(--shadow-elevated)]"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-700">Devlumiq ATS</p>
                  <p className="text-xs text-brand-400">The modern way</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Beautiful, intuitive UI teams love',
                  'Up and running with the seeded demo quickly',
                  'Auto-parse resumes with AI or rules',
                  'Smart ranking scores candidates instantly',
                  'Regular / Extended one-time licenses',
                  'Full mobile-first responsive design',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-stone-700">
                    <CheckCircle2 className="mt-0.5 flex-shrink-0 w-5 h-5 text-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>
      {/* --- Section: Comparison Why Us - end --- */}

      {/* --- Section: FAQ - start --- */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-stone-50 relative overflow-hidden">
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(13 148 136) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-14">
            <SectionHeading icon={MessageSquare} title="Frequently asked questions" subtitle="Everything you need to know before you get started." />
          </div>
          <FAQAccordion />
          <div className="text-center mt-12">
            <div className="inline-flex flex-col sm:flex-row items-center gap-3 px-6 py-4 rounded-2xl bg-white border border-stone-200/80 shadow-[var(--shadow-card)]">
              <div className="flex -space-x-2">
                {['from-brand-500 to-teal-600', 'from-violet-500 to-purple-600', 'from-amber-500 to-orange-600'].map((g, i) => (
                  <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-white flex-shrink-0`} />
                ))}
              </div>
              <p className="text-sm text-stone-500">
                Still have questions?{' '}
                <Link href="/contact" className="text-brand-600 font-semibold hover:underline">Talk to our team →</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* --- Section: FAQ - end --- */}

      {/* Command Hub — dark showcase */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-stone-100 via-stone-50 to-white" />
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: `radial-gradient(ellipse 60% 40% at 50% 20%, rgba(13,148,136,0.12), transparent 60%)` }} />
        <div className="max-w-4xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl shadow-stone-900/20 ring-1 ring-stone-800/60"
          >
            {/* Dark card */}
            <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-900 to-teal-950/90" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(20,184,166,0.15),transparent_50%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:32px_32px]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent" />

            <div className="relative p-8 sm:p-12 md:p-16">
              {/* Stacked layout — no overflow */}
              <div className="flex flex-col gap-10 sm:gap-12">
                {/* Header block */}
                <div className="text-center space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400/80" />
                      <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-medium text-stone-300 uppercase tracking-wider">{t('home.commandHubBadge')}</span>
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 }}
                    className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
                  >
                    <span className="bg-gradient-to-br from-white to-stone-300 bg-clip-text text-transparent">
                      {t('home.commandHubTitle')}
                    </span>
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="text-stone-400 text-sm sm:text-base leading-relaxed max-w-xl mx-auto"
                  >
                    {t('home.commandHubDesc')}
                  </motion.p>
                </div>

                {/* Feature strip — 3+2 on mobile, 5 cols on desktop */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
                >
                  {[
                    { icon: GripVertical, label: 'Pipeline' },
                    { icon: Calendar, label: 'Calendar' },
                    { icon: Mail, label: 'Inbox' },
                    { icon: MessageSquare, label: 'Chat' },
                    { icon: BarChart3, label: 'Analytics' },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.04 }}
                      whileHover={{ y: -2 }}
                      className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-brand-500/25 transition-all duration-300 cursor-default min-w-0"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500/30 to-teal-600/20 flex items-center justify-center border border-white/10 group-hover:border-brand-400/30 group-hover:shadow-lg group-hover:shadow-brand-500/10 transition-all">
                        <item.icon className="w-5 h-5 text-brand-400" />
                      </div>
                      <span className="text-xs font-medium text-stone-300 group-hover:text-white transition-colors text-center leading-tight">{item.label}</span>
                    </motion.div>
                  ))}
                </motion.div>

                {/* CTAs */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.35 }}
                  className="flex flex-col sm:flex-row gap-3 justify-center"
                >
                  <Link href="/login">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-cta-primary w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-brand-500/25 inline-flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
                    >
                      <LayoutDashboard className="w-5 h-5 text-white" />
                      <span className="whitespace-nowrap">{t('home.tryItNow')}</span>
                    </motion.button>
                  </Link>
                  <Link href="/pricing">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-cta-outline-light w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold inline-flex items-center justify-center min-h-[48px] touch-manipulation"
                    >
                      <span className="whitespace-nowrap">{t('home.comparePlans')}</span>
                    </motion.button>
                  </Link>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      {/* --- Section: Dashboard CTA - end --- */}

      {/* --- Section: CTA - start --- */}
      <CTASection />
      {/* --- Section: CTA - end --- */}
    </>
  );
}
