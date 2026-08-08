'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Target, Heart, Zap, Users, Globe, Award, Linkedin, Twitter, Mail, Calendar, ArrowRight } from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import SectionHeading from '@/components/ui/SectionHeading';
import { useLocale } from '@/components/providers/LocaleProvider';

const valueKeys = [
  { icon: Target, titleKey: 'about.value1Title', descKey: 'about.value1Desc', gradient: 'from-brand-500 to-teal-600', hoverGradient: 'from-brand-500/20 to-teal-500/20' },
  { icon: Heart, titleKey: 'about.value2Title', descKey: 'about.value2Desc', gradient: 'from-rose-500 to-pink-600', hoverGradient: 'from-rose-500/20 to-pink-500/20' },
  { icon: Zap, titleKey: 'about.value3Title', descKey: 'about.value3Desc', gradient: 'from-amber-500 to-orange-600', hoverGradient: 'from-amber-500/15 to-orange-500/15' },
  { icon: Users, titleKey: 'about.value4Title', descKey: 'about.value4Desc', gradient: 'from-violet-500 to-purple-600', hoverGradient: 'from-violet-500/20 to-purple-500/20' },
];

const statKeys = [
  { value: '10', labelKey: 'about.stat1' },
  { value: '5', labelKey: 'about.stat2' },
  { value: 'v2.2', labelKey: 'about.stat3' },
  { value: 'DB', labelKey: 'about.stat4' },
];

const timelineKeys = [
  { year: 'Core', titleKey: 'about.timeline1Title', descKey: 'about.timeline1Desc' },
  { year: 'Collab', titleKey: 'about.timeline2Title', descKey: 'about.timeline2Desc' },
  { year: 'AI', titleKey: 'about.timeline3Title', descKey: 'about.timeline3Desc' },
  { year: 'Secure', titleKey: 'about.timeline4Title', descKey: 'about.timeline4Desc' },
  { year: 'i18n', titleKey: 'about.timeline5Title', descKey: 'about.timeline5Desc' },
];

const teamKeys = [
  { name: 'Application', roleKey: 'about.team1Role', avatar: 'APP', bioKey: 'about.team1Bio' },
  { name: 'Experience', roleKey: 'about.team2Role', avatar: 'UX', bioKey: 'about.team2Bio' },
  { name: 'Data layer', roleKey: 'about.team3Role', avatar: 'DB', bioKey: 'about.team3Bio' },
  { name: 'Docs', roleKey: 'about.team4Role', avatar: 'DOC', bioKey: 'about.team4Bio' },
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function AboutPage() {
  const { t } = useLocale();
  return (
    <>
      {/* --- Section: Hero - start --- */}
      {/* Hero */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-stone-50 via-white to-stone-50 overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <SectionHeading icon={Target} title={t('about.title')} subtitle={t('about.intro')} animate />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 sm:mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
            {statKeys.map((stat, i) => (
              <div
                key={stat.labelKey}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/80 shadow-[var(--shadow-card)] hover:border-brand-200/80 hover:shadow-[var(--shadow-elevated)] transition-all duration-300 text-center min-w-0"
              >
                <div className="text-xl sm:text-2xl font-extrabold text-brand-600">{stat.value}</div>
                <p className="text-xs sm:text-sm font-medium text-stone-500 mt-1 break-words">{t(stat.labelKey)}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>
      {/* --- Section: Hero - end --- */}

      {/* --- Section: Timeline - start --- */}
      {/* Timeline */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/30 via-white to-teal-50/20 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative">
          <div className="text-center mb-10 sm:mb-14">
            <SectionHeading icon={Calendar} title={t('about.journeyTitle')} />
          </div>
          <div className="relative">
            {/* Vertical line - visible on all screens, left-aligned on mobile */}
            <div className="absolute left-4 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-500 via-teal-500 to-brand-500" />
            <div className="space-y-6 sm:space-y-8">
              {timelineKeys.map((item, i) => (
                <motion.div
                  key={`${item.year}-${item.titleKey}`}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-24px' }}
                  transition={{ delay: i * 0.06 }}
                  className="relative pl-12 sm:pl-0 sm:flex sm:items-stretch sm:gap-0"
                >
                  <div className={`flex-1 min-w-0 sm:pr-8 ${i % 2 === 1 ? 'sm:order-3 sm:pl-8 sm:pr-0' : 'sm:text-right'}`}>
                    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/80 shadow-[var(--shadow-card)] hover:border-brand-200/80 hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
                      <span className="text-brand-600 font-bold text-sm">{item.year}</span>
                      <h3 className="font-bold text-stone-900 mt-1 text-base sm:text-lg">{t(item.titleKey)}</h3>
                      <p className="text-sm text-stone-500 mt-1 leading-relaxed">{t(item.descKey)}</p>
                    </div>
                  </div>
                  <div className="absolute left-[10px] top-6 w-3 h-3 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-4 sm:h-4 rounded-full bg-brand-500 border-2 sm:border-4 border-white shadow-lg z-10 flex-shrink-0" aria-hidden />
                  <div className="hidden sm:block flex-1 min-w-0" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* --- Section: Timeline - end --- */}

      {/* --- Section: Values - start --- */}
      {/* Values */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-stone-50 overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="space-y-5 sm:space-y-6"
          >
            {valueKeys.map((v, i) => {
              const Icon = v.icon;
              return (
                <motion.div
                  key={v.titleKey}
                  variants={item}
                  className="group relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)] hover:border-brand-200/80 hover:shadow-[var(--shadow-elevated)] transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${v.hoverGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`} />
                  <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-6 p-6 sm:p-8">
                    <div className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${v.gradient} flex items-center justify-center shadow-[var(--shadow-card)] group-hover:scale-105 transition-transform`}>
                      <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg sm:text-xl font-bold text-stone-900">{t(v.titleKey)}</h3>
                      <p className="text-stone-600 mt-2 text-sm sm:text-base leading-relaxed">{t(v.descKey)}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>
      {/* --- Section: Values - end --- */}

      {/* --- Section: Team - start --- */}
      {/* Team */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-stone-50/50 to-white pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <div className="text-center mb-6">
            <SectionHeading icon={Users} title={t('about.teamTitle')} subtitle={t('about.teamSubtitle')} />
          </div>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6"
          >
            {teamKeys.map((member, i) => (
              <motion.div
                key={member.name}
                variants={item}
                className="flex flex-col sm:flex-row gap-4 p-5 sm:p-6 rounded-2xl border border-stone-200/80 bg-white shadow-[var(--shadow-card)] hover:border-brand-200/80 hover:shadow-[var(--shadow-elevated)] transition-all duration-300 overflow-hidden"
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0d9488&color=fff&size=128&bold=true&length=2`}
                  alt={member.name}
                  className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl shadow-lg shadow-brand-500/25 object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg">{member.name}</h3>
                  <p className="text-brand-600 font-medium text-sm mt-0.5">{t(member.roleKey)}</p>
                  <p className="text-stone-500 text-sm mt-1.5 leading-relaxed">{t(member.bioKey)}</p>
                  <div className="flex gap-2 mt-3">
                    <button className="p-2 rounded-lg hover:bg-brand-50 text-stone-500 hover:text-brand-600 transition-colors" aria-label="LinkedIn">
                      <Linkedin className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-brand-50 text-stone-500 hover:text-brand-600 transition-colors" aria-label="Twitter">
                      <Twitter className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-brand-50 text-stone-500 hover:text-brand-600 transition-colors" aria-label="Email">
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      {/* --- Section: Team - end --- */}

      {/* --- Section: Global CTA - start --- */}
      {/* Global CTA card */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-stone-900 to-stone-950 text-white shadow-[var(--shadow-elevated)] p-6 sm:p-10 md:p-12"
          >
            <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
              <div className="flex gap-3 flex-shrink-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-brand-500/30 flex items-center justify-center">
                  <Globe className="w-6 h-6 sm:w-7 sm:h-7 text-brand-300" />
                </div>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-500/30 flex items-center justify-center">
                  <Award className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left min-w-0">
                <h3 className="text-xl sm:text-2xl font-bold mb-2">{t('about.globalTitle')}</h3>
                <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
                  {t('about.globalDesc')}
                </p>
              </div>
              <Link href="/contact" className="w-full sm:w-auto flex justify-center min-w-0">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="btn-cta-outline w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold border-2 border-stone-400 text-white hover:bg-white/10 inline-flex items-center justify-center gap-2"
                >
                  <span className="relative z-10">{t('about.getInTouch')}</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
      {/* --- Section: Global CTA - end --- */}

      {/* --- Section: CTA - start --- */}
      <CTASection
        title={t('about.ctaTitle')}
        subtitle={t('about.ctaSubtitle')}
      />
      {/* --- Section: CTA - end --- */}
    </>
  );
}
