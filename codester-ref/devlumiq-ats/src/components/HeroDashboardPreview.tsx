'use client';

import type React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Home,
  Users,
  FolderOpen,
  BarChart2,
  UserPlus,
  ChevronUp,
} from 'lucide-react';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useState } from 'react';
import Logo from '@/components/Logo';
import { spring, tween, staggerDelay } from '@/lib/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Chart bar — uses scaleY (transform) for performance, not height
function ChartBar({ height, delay, reduced }: { height: number; delay: number; reduced: boolean }) {
  return (
    <motion.div
      className="flex-1 bg-gradient-to-t from-brand-600 to-teal-400 rounded-t min-h-[6px] origin-bottom"
      initial={reduced ? false : { scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={reduced ? { duration: 0.01 } : { ...spring.tight, delay }}
    />
  );
}

// Dashboard view
function DashboardView({ reduced }: { reduced: boolean }) {
  const stats = [
    { value: '1,247', label: 'Candidates', icon: Users, color: 'text-brand-600' },
    { value: '89', label: 'This Month', icon: UserPlus, color: 'text-brand-600' },
  ];
  const chartBars = [45, 72, 38, 85, 62, 55, 78, 48];

  return (
    <div className="h-full flex flex-col gap-3 sm:gap-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? undefined : { ...spring.smooth, delay: i * staggerDelay }}
              whileHover={reduced ? undefined : { y: -2 }}
              className="bg-white rounded-xl p-3 sm:p-4 border border-stone-200/80 shadow-sm hover:shadow-md transition-shadow"
            >
              <Icon className={`w-5 h-5 ${s.color} mb-1.5 sm:mb-2`} />
              <p className="text-lg sm:text-xl font-bold text-stone-900">{s.value}</p>
              <p className="text-[10px] sm:text-xs text-stone-500">{s.label}</p>
            </motion.div>
          );
        })}
      </div>
      <motion.div
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduced ? undefined : { ...tween.fast, delay: 0.1 }}
        className="flex-1 min-h-[100px] sm:min-h-[120px] bg-white rounded-xl p-3 sm:p-4 border border-stone-200/80 shadow-sm flex items-end gap-1"
      >
        {chartBars.map((h, i) => (
          <ChartBar key={i} height={h} delay={0.12 + i * 0.03} reduced={reduced} />
        ))}
      </motion.div>
    </div>
  );
}

// Candidates view
function CandidatesView({ reduced }: { reduced: boolean }) {
  const candidates = [
    { name: 'Sarah Johnson', role: 'Senior Developer', avatar: 'SJ', color: 'from-pink-500 to-rose-500' },
    { name: 'Mike Chen', role: 'UX Designer', avatar: 'MC', color: 'from-cyan-500 to-blue-500' },
    { name: 'Emily Davis', role: 'Product Manager', avatar: 'ED', color: 'from-purple-500 to-violet-500' },
    { name: 'James Wilson', role: 'DevOps Engineer', avatar: 'JW', color: 'from-emerald-500 to-teal-500' },
  ];
  return (
    <div className="h-full flex flex-col gap-2 overflow-auto -mr-1 pr-1">
      {candidates.map((c, i) => (
        <motion.div
          key={c.name}
          initial={reduced ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduced ? undefined : { ...spring.smooth, delay: i * staggerDelay }}
          whileTap={reduced ? undefined : { scale: 0.98 }}
          className="flex gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-xl border border-stone-200/80 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center text-white text-[10px] sm:text-xs font-bold flex-shrink-0`}>
            {c.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-stone-900 truncate">{c.name}</p>
            <p className="text-[10px] sm:text-xs text-stone-500 truncate">{c.role}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Jobs view
function JobsView({ reduced }: { reduced: boolean }) {
  const jobs = [
    { title: 'Senior Developer', count: 12 },
    { title: 'UX Designer', count: 5 },
    { title: 'Product Manager', count: 3 },
  ];
  return (
    <div className="h-full flex flex-col gap-2">
      {jobs.map((j, i) => (
        <motion.div
          key={j.title}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? undefined : { ...spring.smooth, delay: i * staggerDelay }}
          whileTap={reduced ? undefined : { scale: 0.98 }}
          className="flex justify-between items-center p-2.5 sm:p-3 bg-white rounded-xl border border-stone-200/80 shadow-sm"
        >
          <span className="text-xs sm:text-sm font-medium text-stone-900 truncate">{j.title}</span>
          <span className="text-[10px] sm:text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0 ml-2">{j.count}</span>
        </motion.div>
      ))}
    </div>
  );
}

// Analytics view
function AnalyticsView({ reduced }: { reduced: boolean }) {
  const bars = [65, 82, 45, 90, 70, 55, 78, 62];
  return (
    <div className="h-full flex flex-col gap-2 sm:gap-3">
      <div className="grid grid-cols-2 gap-2">
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? undefined : tween.fast}
          className="bg-white rounded-xl p-2.5 sm:p-3 border border-stone-200/80 shadow-sm"
        >
          <p className="text-base sm:text-lg font-bold text-stone-900">23</p>
          <p className="text-[10px] sm:text-xs text-stone-500">Pending</p>
        </motion.div>
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? undefined : { ...tween.fast, delay: staggerDelay }}
          className="bg-white rounded-xl p-2.5 sm:p-3 border border-stone-200/80 shadow-sm"
        >
          <p className="text-base sm:text-lg font-bold text-stone-900">20</p>
          <p className="text-[10px] sm:text-xs text-stone-500">Hired</p>
        </motion.div>
      </div>
      <div className="flex-1 flex items-end gap-1 sm:gap-1.5 min-h-[80px] sm:min-h-[100px] bg-white rounded-xl p-3 sm:p-4 border border-stone-200/80 shadow-sm">
        {bars.map((h, i) => (
          <ChartBar key={i} height={h} delay={0.08 + i * 0.03} reduced={reduced} />
        ))}
      </div>
    </div>
  );
}

const viewMap: Record<string, React.ComponentType<{ reduced: boolean }>> = {
  dashboard: DashboardView,
  candidates: CandidatesView,
  jobs: JobsView,
  analytics: AnalyticsView,
};

export default function HeroDashboardPreview() {
  const [active, setActive] = useState('dashboard');
  const reduced = useReducedMotion();
  const { t } = useLocale();

  const navItems = [
    { id: 'dashboard', icon: Home, labelKey: 'dashboard.title' },
    { id: 'candidates', icon: Users, labelKey: 'dashboard.candidates' },
    { id: 'jobs', icon: FolderOpen, labelKey: 'dashboard.jobs' },
    { id: 'analytics', icon: BarChart2, labelKey: 'dashboard.analytics' },
  ];

  const viewTransition = reduced ? { duration: 0.01 } : { ...spring.tight };

  return (
    <section className="relative min-h-screen flex flex-col justify-center py-12 sm:py-20 lg:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-[#0f0f0f]" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 184, 166, 0.12) 0%, rgba(13, 148, 136, 0.04) 30%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 min-w-0">
        {/* Hero copy */}
        <div className="text-center mb-8 sm:mb-12">
          {/* Badge */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? undefined : tween.normal}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.07] border border-white/10 mb-5 sm:mb-6"
          >
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400/70" />
              <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-stone-300 uppercase tracking-widest">
              {t('hero.subtitle')}
            </span>
          </motion.div>
          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? undefined : { ...tween.normal, delay: 0.05 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight px-1 leading-[1.08]"
          >
            <span className="bg-gradient-to-br from-white via-white to-stone-300 bg-clip-text text-transparent">
              {t('hero.title')}
            </span>
            <br />
            <span className="bg-gradient-to-r from-brand-400 via-teal-400 to-brand-500 bg-clip-text text-transparent">
              {t('hero.titleSub')}
            </span>
          </motion.h1>
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? undefined : { ...tween.normal, delay: 0.1 }}
            className="mt-4 sm:mt-6 text-sm sm:text-lg text-stone-400 max-w-2xl mx-auto px-2 leading-relaxed"
          >
            {t('hero.desc')}
          </motion.p>
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? undefined : { ...tween.normal, delay: 0.15 }}
            className="mt-7 sm:mt-9 flex flex-wrap justify-center gap-3 sm:gap-4"
          >
            <Link href="/login" className="btn-cta-primary group inline-flex items-center gap-2 px-5 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-white shadow-lg shadow-brand-500/35 text-sm sm:text-base">
              {t('hero.viewDashboard')}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 sm:px-8 py-3.5 sm:py-4 rounded-xl font-semibold text-white border border-stone-500 hover:border-stone-400 hover:bg-white/5 transition-all active:scale-[0.97] text-sm sm:text-base"
            >
              {t('hero.pricing')}
            </Link>
          </motion.div>

          {/* Social proof trust row */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? undefined : { ...tween.normal, delay: 0.22 }}
            className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
          >
            {/* Avatar stack */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {[
                  'from-brand-500 to-teal-600',
                  'from-violet-500 to-purple-600',
                  'from-rose-500 to-pink-600',
                  'from-amber-500 to-orange-600',
                  'from-emerald-500 to-teal-600',
                ].map((g, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} border-2 border-stone-900 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 shadow-lg`}
                  >
                    {['SC', 'MJ', 'PP', 'JM', 'EP'][i]}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white leading-tight">{t('hero.socialProof')}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 fill-amber-400" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-[10px] text-stone-400 ml-0.5">Self-hosted ATS</span>
                </div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-stone-700" />
            {/* Trust badges */}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                {t('hero.freeBadge')}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-stone-400 text-[11px] font-medium">
                {t('hero.noCreditCard')}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Dashboard preview */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? undefined : { ...tween.normal, delay: 0.2 }}
          className="relative"
        >
          <div className="rounded-xl sm:rounded-2xl overflow-hidden border border-stone-700/80 shadow-2xl shadow-black/40 ring-1 ring-stone-700/50">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-stone-800/95 border-b border-stone-700/80">
              <div className="flex gap-1.5 flex-shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/90" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/90" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/90" />
              </div>
              <span className="flex-1 text-center text-[10px] sm:text-[11px] text-stone-500 font-mono truncate px-2">app.devlumiq.com/dashboard</span>
              <div className="w-8 sm:w-12 flex-shrink-0" />
            </div>

            <div className="flex min-h-[280px] xs:min-h-[320px] sm:min-h-[360px] lg:min-h-[380px]">
              {/* Sidebar */}
              <div className="w-16 sm:w-20 flex-shrink-0 bg-stone-900/95 flex flex-col items-center py-3 sm:py-4 gap-2 sm:gap-3 border-r border-stone-700/60">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30 flex-shrink-0">
                  <Logo className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <p className="text-[8px] sm:text-[9px] font-bold text-white text-center leading-tight px-0.5 sm:px-1 flex-shrink-0">Devlumiq ATS</p>
                <nav className="flex-1 flex flex-col gap-0.5 sm:gap-1 w-full px-1.5 sm:px-2 min-h-0">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActive(item.id)}
                        className={`w-full flex flex-col items-center gap-0.5 sm:gap-1 py-2 sm:py-2.5 rounded-lg transition-colors duration-200 active:scale-[0.97] touch-manipulation ${
                          isActive
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[8px] sm:text-[9px] font-medium leading-tight truncate w-full text-center">{t(item.labelKey)}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Main content */}
              <div className="relative flex-1 min-w-0 p-3 sm:p-4 bg-stone-100/80 flex flex-col overflow-hidden">
                <div className="mb-2 sm:mb-3 space-y-1.5 sm:space-y-2 flex-shrink-0">
                  <div className="h-1.5 sm:h-2 w-2/3 bg-stone-300/80 rounded" />
                  <div className="h-1.5 sm:h-2 w-1/3 bg-stone-300/60 rounded" />
                </div>
                <div className="flex-1 min-h-0 overflow-auto overscroll-contain relative">
                  <AnimatePresence mode="wait">
                    {(() => {
                      const imageMap: Record<string, string> = {
                        dashboard: '/images/website-dashboard-preview.png',
                        candidates: '/images/website-candidates-search-preview.png',
                        jobs: '/images/website-open-positions-preview.png',
                        analytics: '/images/webite-analytics-preview.png',
                      };
                      const imageSrc = imageMap[active] || '/images/website-dashboard-preview.png';
                      return (
                        <motion.div
                          key={active}
                          initial={reduced ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={reduced ? undefined : { opacity: 0 }}
                          transition={reduced ? { duration: 0.01 } : { ...spring.tight }}
                          className="h-full min-h-0 relative flex items-center justify-center bg-stone-50"
                        >
                          <Image
                            src={imageSrc}
                            alt={`${active} view`}
                            fill
                            className="object-contain object-center p-2 sm:p-4"
                            priority
                          />
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </div>
                <div className="absolute bottom-3 right-4 sm:bottom-4 sm:right-6">
                  <motion.div
                    whileHover={reduced ? undefined : { scale: 1.08 }}
                    whileTap={reduced ? undefined : { scale: 0.95 }}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/35 cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -inset-2 sm:-inset-3 bg-brand-500/5 rounded-2xl blur-2xl -z-10 pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
}
