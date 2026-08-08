'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, HelpCircle, ArrowRight,
  BookOpen, CreditCard, Settings, Search, Zap,
  Mail, Calendar, Sparkles, CheckCircle2, X, MessagesSquare,
} from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';
import { tween, spring } from '@/lib/motion';

/* â”€â”€â”€ Static data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const faqCategoryKeys = [
  {
    key: 'cat1',
    titleKey: 'faq.cat1',
    icon: BookOpen,
    gradient: 'from-brand-500 to-teal-600',
    shadowColor: 'rgba(20,184,166,0.25)',
    qaKeys: [['faq.q1','faq.a1'],['faq.q2','faq.a2'],['faq.q3','faq.a3']],
  },
  {
    key: 'cat2',
    titleKey: 'faq.cat2',
    icon: CreditCard,
    gradient: 'from-amber-500 to-orange-600',
    shadowColor: 'rgba(245,158,11,0.22)',
    qaKeys: [['faq.q4','faq.a4'],['faq.q5','faq.a5'],['faq.q6','faq.a6']],
  },
  {
    key: 'cat3',
    titleKey: 'faq.cat3',
    icon: Settings,
    gradient: 'from-violet-500 to-purple-600',
    shadowColor: 'rgba(139,92,246,0.22)',
    qaKeys: [['faq.q7','faq.a7'],['faq.q8','faq.a8'],['faq.q9','faq.a9']],
  },
  {
    key: 'cat4',
    titleKey: 'faq.cat4',
    icon: Zap,
    gradient: 'from-rose-500 to-pink-600',
    shadowColor: 'rgba(244,63,94,0.22)',
    qaKeys: [['faq.q10','faq.a10'],['faq.q11','faq.a11'],['faq.q12','faq.a12']],
  },
];

const supportChannels = [
  {
    icon: MessagesSquare,
    labelKey: 'faq.liveChat',
    descKey: 'faq.liveChatDesc',
    gradient: 'from-brand-500 to-teal-600',
    href: '/login',
    badge: 'Online',
    badgeClass: 'bg-emerald-500',
  },
  {
    icon: Mail,
    labelKey: 'faq.emailSupportLabel',
    descKey: 'faq.emailSupportDesc',
    gradient: 'from-violet-500 to-purple-600',
    href: '/contact',
    badge: '< 24h',
    badgeClass: 'bg-violet-500',
  },
  {
    icon: Calendar,
    labelKey: 'faq.bookCall',
    descKey: 'faq.bookCallDesc',
    gradient: 'from-amber-500 to-orange-500',
    href: '/contact',
    badge: 'Free',
    badgeClass: 'bg-amber-500',
  },
];

/* â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function FAQPage() {
  const [openKey, setOpenKey]           = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const accordionRef = useRef<HTMLDivElement>(null);
  const { t } = useLocale();

  const baseCategories = activeCategory
    ? faqCategoryKeys.filter((c) => c.key === activeCategory)
    : faqCategoryKeys;

  const filteredCategories = search.trim()
    ? baseCategories
        .map((cat) => ({
          ...cat,
          qaKeys: cat.qaKeys.filter(
            ([qKey, aKey]) =>
              t(qKey).toLowerCase().includes(search.toLowerCase()) ||
              t(aKey).toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((cat) => cat.qaKeys.length > 0)
    : baseCategories;

  const handleCategoryClick = (key: string) => {
    setActiveCategory((prev) => (prev === key ? null : key));
    setOpenKey(null);
    setTimeout(() => accordionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  };

  return (
    <>
      {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative py-16 sm:py-24 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[#0f0f0f]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(20,184,166,0.14) 0%, rgba(13,148,136,0.04) 35%, transparent 70%)' }}
        />
        <div className="absolute top-24 left-1/4 w-80 h-80 bg-brand-500/[0.07] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-48 right-1/4 w-56 h-56 bg-violet-500/[0.07] rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={tween.normal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-6"
          >
            <HelpCircle className="w-4 h-4 text-brand-400" />
            <span className="text-xs sm:text-sm font-semibold text-stone-300 uppercase tracking-[0.18em]">
              {t('faq.badge')}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tween.normal, delay: 0.06 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight"
          >
            {t('faq.title')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tween.normal, delay: 0.12 }}
            className="mt-4 text-sm sm:text-lg text-stone-400 max-w-2xl mx-auto"
          >
            {t('faq.subtitle')}
          </motion.p>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tween.normal, delay: 0.2 }}
            className="mt-8 max-w-2xl mx-auto"
          >
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none group-focus-within:text-brand-400 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setActiveCategory(null); }}
                placeholder={t('faq.searchPlaceholder')}
                className="w-full pl-14 pr-12 py-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-stone-500 focus:border-brand-500/60 focus:bg-white/[0.12] focus:outline-none text-sm sm:text-base backdrop-blur-sm transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/20 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Trust pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.32 }}
            className="mt-7 flex items-center justify-center gap-4 sm:gap-6 flex-wrap"
          >
            {[
              { icon: MessagesSquare, key: 'faq.liveChat' },
              { icon: Mail,           key: 'faq.emailSupportLabel' },
              { icon: Calendar,       key: 'faq.bookCall' },
            ].map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-stone-500 text-xs sm:text-sm font-medium">{t(key)}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ Browse by topic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="pt-10 pb-4 sm:pt-14 sm:pb-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-stone-50 to-white">
        <div className="max-w-5xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={tween.normal}
            className="text-center text-[11px] font-bold text-stone-400 uppercase tracking-[0.22em] mb-5"
          >
            {t('faq.browseTopics')}
          </motion.p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {faqCategoryKeys.map((cat, i) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <motion.button
                  key={cat.key}
                  type="button"
                  onClick={() => handleCategoryClick(cat.key)}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ ...spring.smooth, delay: i * 0.07 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ boxShadow: isActive ? `0 4px 24px -4px ${cat.shadowColor}` : undefined }}
                  className={`group relative flex flex-col items-start gap-3 p-5 rounded-2xl border text-left transition-all duration-300 overflow-hidden ${
                    isActive
                      ? 'border-brand-400/50 bg-white'
                      : 'border-stone-200 bg-white/80 hover:border-brand-200/50 hover:bg-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCatBg"
                      className="absolute inset-0 bg-gradient-to-br from-brand-50/70 to-teal-50/30 pointer-events-none"
                    />
                  )}
                  <div className={`relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="relative min-w-0 w-full">
                    <p className="font-bold text-stone-900 text-sm leading-tight line-clamp-2">{t(cat.titleKey)}</p>
                    <p className="text-stone-400 text-[11px] mt-0.5">{cat.qaKeys.length} articles</p>
                  </div>
                  {isActive && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {(activeCategory || search) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 flex justify-center"
            >
              <button
                onClick={() => { setActiveCategory(null); setSearch(''); setOpenKey(null); }}
                className="inline-flex items-center gap-1.5 text-xs text-brand-600 font-semibold bg-brand-50 hover:bg-brand-100 border border-brand-100 px-3 py-1.5 rounded-full transition-colors"
              >
                <X className="w-3 h-3" /> {t('faq.clearSearch')}
              </button>
            </motion.div>
          )}
        </div>
      </section>

      {/* â”€â”€ Accordion section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section ref={accordionRef} className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {filteredCategories.length === 0 ? (
              <motion.div
                key="no-results"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center py-20"
              >
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-5">
                  <Search className="w-7 h-7 text-stone-400" />
                </div>
                <p className="text-stone-800 text-lg font-bold">{t('faq.noResults')} &ldquo;{search}&rdquo;</p>
                <p className="text-stone-500 text-sm mt-2 mb-5">{t('faq.stillDesc')}</p>
                <button
                  onClick={() => setSearch('')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 bg-brand-50 border border-brand-100 hover:bg-brand-100 px-4 py-2 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> {t('faq.clearSearch')}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5 sm:space-y-6"
              >
                {filteredCategories.map((category, ci) => {
                  const Icon = category.icon;
                  return (
                    <motion.div
                      key={category.titleKey}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ ...tween.normal, delay: ci * 0.05 }}
                      className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-stone-200/80 bg-white shadow-[var(--shadow-card)] hover:border-brand-200/50 hover:shadow-[var(--shadow-elevated)] transition-all duration-300"
                    >
                      {/* Category header */}
                      <div className="flex items-center gap-4 px-6 sm:px-8 pt-6 pb-4 border-b border-stone-100">
                        <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${category.gradient} flex items-center justify-center shadow-md`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg sm:text-xl font-bold text-stone-900">{t(category.titleKey)}</h2>
                          <p className="text-xs text-stone-400 mt-0.5">{category.qaKeys.length} articles</p>
                        </div>
                      </div>

                      {/* Q&A rows */}
                      <div className="divide-y divide-stone-100/80">
                        {category.qaKeys.map(([qKey, aKey], i) => {
                          const key = `${category.titleKey}-${i}`;
                          const isOpen = openKey === key;
                          return (
                            <div key={key} className="bg-white hover:bg-stone-50/60 transition-colors">
                              <button
                                type="button"
                                onClick={() => setOpenKey(isOpen ? null : key)}
                                className="w-full flex items-center justify-between gap-4 px-6 sm:px-8 py-4 sm:py-5 text-left font-semibold text-stone-900 min-h-[52px] touch-manipulation"
                              >
                                <span className="text-sm sm:text-base">{t(qKey)}</span>
                                <motion.span
                                  animate={{ rotate: isOpen ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex-shrink-0"
                                >
                                  <ChevronDown className="w-5 h-5 text-stone-400" />
                                </motion.span>
                              </button>
                              <AnimatePresence>
                                {isOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                                    className="overflow-hidden border-t border-stone-100"
                                  >
                                    <div className="relative px-6 sm:px-8 py-4 sm:py-5 bg-stone-50/60">
                                      <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-400/50 to-transparent" />
                                      <p className="pl-4 text-stone-600 leading-relaxed text-sm sm:text-base">{t(aKey)}</p>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* â”€â”€ Support channels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-stone-50/80">
        <div className="max-w-5xl mx-auto">
          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={tween.normal}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-100 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">{t('faq.stillQuestions')}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-stone-900">{t('faq.stillDesc')}</p>
          </motion.div>

          {/* Channel cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {supportChannels.map((ch, i) => {
              const Icon = ch.icon;
              return (
                <motion.a
                  key={ch.labelKey}
                  href={ch.href}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ ...spring.smooth, delay: i * 0.09 }}
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="group relative flex flex-col gap-4 p-6 sm:p-7 rounded-2xl border border-stone-200/80 bg-white hover:border-brand-200/50 hover:shadow-[0_8px_32px_-8px_rgba(20,184,166,0.2)] transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-stone-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ch.gradient} flex items-center justify-center shadow-md`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className={`text-[11px] font-black text-white px-2.5 py-1 rounded-full ${ch.badgeClass}`}>
                      {ch.badge}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-stone-900 text-base">{t(ch.labelKey)}</p>
                    <p className="text-stone-500 text-sm mt-1 leading-relaxed">{t(ch.descKey)}</p>
                  </div>
                  <div className="flex items-center gap-1 text-brand-600 text-sm font-bold group-hover:gap-2 transition-all">
                    {t('faq.contactSupport')} <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.a>
              );
            })}
          </div>
        </div>
      </section>

      {/* â”€â”€ CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <CTASection title={t('faq.ctaTitle')} subtitle={t('faq.ctaSubtitle')} />
    </>
  );
}

