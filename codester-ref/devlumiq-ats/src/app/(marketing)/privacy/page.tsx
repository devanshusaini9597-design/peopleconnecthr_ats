'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Database, Mail, Eye, ShieldCheck, FileText, MessageCircle, ChevronDown } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';
import { useLocale } from '@/components/providers/LocaleProvider';

const sectionConfig = [
  { key: 's1', icon: Shield },
  { key: 's2', icon: Database },
  { key: 's3', icon: Mail },
  { key: 's4', icon: Lock },
  { key: 's5', icon: Eye },
  { key: 's6', icon: ShieldCheck },
  { key: 's7', icon: FileText },
] as const;

export default function PrivacyPage() {
  const { t } = useLocale();
  const [tocOpen, setTocOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof sectionConfig)[number]['key']>('s1');

  return (
    <div className="min-h-screen w-full min-w-0">
      {/* Hero - same style as Features / About */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-stone-50 via-white to-stone-50">
        <div className="max-w-4xl mx-auto text-center">
          <SectionHeading icon={Shield} title={t('privacy.title')} subtitle={t('privacy.updated')} animate />
        </div>
      </section>

      {/* One box: tab-like - sidebar tabs, content switches without scrollbar */}
      <section className="px-4 sm:px-6 lg:px-8 xl:px-12 pb-16 sm:pb-20">
        <div className="max-w-6xl mx-auto rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)] overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Sidebar - tabs (fixed, no scroll) */}
            <aside className="flex-shrink-0 border-b lg:border-b-0 lg:border-r border-stone-200/60 bg-stone-50/50 lg:w-[220px]">
              <div className="p-4 sm:p-5 lg:p-6">
                <button
                  onClick={() => setTocOpen(!tocOpen)}
                  className="lg:hidden w-full flex items-center justify-between py-3 px-4 rounded-xl border border-stone-200 bg-white text-stone-700 font-medium"
                >
                  {t('legal.onThisPage')}
                  <ChevronDown className={`w-4 h-4 transition-transform ${tocOpen ? 'rotate-180' : ''}`} />
                </button>
                <nav className={`${tocOpen ? 'block' : 'hidden'} lg:block mt-2 lg:mt-0`}>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.15em] mb-4">{t('legal.contents')}</p>
                  <ul className="space-y-0.5">
                    {sectionConfig.map(({ key }) => {
                      const titleKey = `privacy.${key}Title` as const;
                      const label = t(titleKey).replace(/^\d+\.\s*/, '');
                      const isActive = activeSection === key;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSection(key);
                              setTocOpen(false);
                            }}
                            className={`w-full text-left block py-2.5 px-3 rounded-lg text-sm transition-all duration-200 ${
                              isActive
                                ? 'text-brand-600 font-semibold bg-brand-50 ring-1 ring-brand-200/50'
                                : 'text-stone-600 hover:text-brand-600 hover:bg-stone-50 hover:ring-1 hover:ring-stone-200'
                            }`}
                          >
                            {label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            </aside>

            {/* Content - tab panel, no scrollbar */}
            <article className="flex-1 min-w-0 min-h-[320px] lg:min-h-[400px]">
              <div className="p-4 sm:p-6 lg:p-8 relative">
                <AnimatePresence mode="wait">
                  {sectionConfig.map(({ key, icon: Icon }) => {
                    if (activeSection !== key) return null;
                    const titleKey = `privacy.${key}Title` as const;
                    const bodyKey = `privacy.${key}Body` as const;
                    const pointsKey = `privacy.${key}Points` as const;
                    const pointsStr = t(pointsKey);
                    const points = pointsStr && pointsStr !== pointsKey ? pointsStr.split('||').map((p) => p.trim()).filter(Boolean) : [];
                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2 }}
                        className="relative pl-8 sm:pl-10 border-l-2 border-stone-200 ml-4 sm:ml-5"
                      >
                        <motion.div whileHover={{ scale: 1.03 }} className="absolute -left-[29px] sm:-left-[33px] top-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/20 flex-shrink-0">
                          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </motion.div>
                        <div className="min-w-0 space-y-4">
                          <h2 className="text-lg sm:text-xl font-bold text-stone-900 mb-3">{t(titleKey)}</h2>
                          <div className="space-y-4">
                            {(t(bodyKey) as string).split('||').map((para, i) => (
                              <p key={i} className="text-stone-600 text-[15px] sm:text-base leading-[1.75] max-w-prose break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                {para.trim()}
                              </p>
                            ))}
                          </div>
                          {points.length > 0 && (
                            <ul className="space-y-2 mt-4">
                              {points.map((point, i) => (
                                <li key={i} className="flex items-start gap-2 text-stone-600 text-[15px] sm:text-base">
                                  <span className="text-brand-500 mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Contact CTA — bar with hover effects */}
      <section className="group relative overflow-hidden border-t border-stone-800/50 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 px-4 sm:px-6 lg:px-8 xl:px-12 py-10 sm:py-12">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 via-transparent to-teal-500/5 pointer-events-none transition-opacity duration-300 group-hover:from-brand-500/10 group-hover:to-teal-500/10" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent opacity-60" />
        <div className="max-w-6xl mx-auto relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8 sm:gap-10">
          <div className="flex items-center gap-5 sm:gap-6 min-w-0">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/25 to-teal-500/25 border border-brand-400/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/10 transition-all duration-300 hover:shadow-brand-500/25 hover:border-brand-400/50"
            >
              <MessageCircle className="w-7 h-7 text-brand-300" />
            </motion.div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg sm:text-xl text-white tracking-tight">{t('legal.questions')}</h3>
              <p className="text-stone-400 text-sm mt-1">{t('legal.responseTime')}</p>
              <a
                href="mailto:privacy@devlumiq.com"
                className="text-brand-300 hover:text-brand-200 font-medium text-sm sm:text-base mt-1 inline-flex items-center gap-1.5 transition-all duration-200 hover:underline hover:gap-2"
              >
                privacy@devlumiq.com
              </a>
            </div>
          </div>
          <Link
            href="/contact"
            className="group/btn inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded-xl font-semibold bg-white text-stone-900 shadow-lg shadow-black/10 transition-all duration-300 min-h-[52px] shrink-0 hover:bg-brand-500 hover:text-white hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-1 hover:scale-[1.02] ring-2 ring-white/20 hover:ring-brand-400/50"
          >
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
