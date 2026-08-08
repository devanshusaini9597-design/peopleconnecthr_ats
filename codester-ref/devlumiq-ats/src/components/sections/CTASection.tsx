'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Sparkles, CheckCircle2, Shield, Clock, Users } from 'lucide-react';
import { useLocale } from '@/components/providers/LocaleProvider';

interface CTASectionProps {
  title?: string;
  subtitle?: string;
  variant?: 'gradient' | 'dark';
}

export default function CTASection({
  title,
  subtitle,
  variant = 'gradient',
}: CTASectionProps) {
  const { t } = useLocale();
  const displayTitle = title ?? t('cta.defaultTitle');
  const displaySubtitle = subtitle ?? t('cta.defaultSubtitle');
  const isGradient = variant === 'gradient';

  return (
    <>
      {/* --- Section: CTASection Root - start --- */}
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className={`relative overflow-hidden py-20 sm:py-24 md:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 pb-[max(4rem,env(safe-area-inset-bottom))] ${
        isGradient ? 'bg-gradient-to-br from-brand-700 via-teal-800 to-brand-900' : 'bg-stone-900'
      }`}
    >
      {/* Layered background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 100% 80% at 50% -20%, rgba(255,255,255,0.12), transparent 55%),
            radial-gradient(ellipse 70% 60% at 90% 70%, rgba(20,184,166,0.18), transparent 50%),
            radial-gradient(ellipse 60% 50% at 10% 90%, rgba(13,148,136,0.15), transparent 45%)
          `,
        }}
      />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: '56px 56px',
        }}
      />
      {/* Ambient orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-teal-400/10 blur-[120px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-brand-500/12 blur-[100px] pointer-events-none translate-y-1/2" />

      <div className="max-w-5xl mx-auto relative z-10 w-full min-w-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative"
        >
          {/* Glass card container */}
          <div className="relative rounded-3xl sm:rounded-[2rem] overflow-hidden border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-2xl shadow-black/20">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] via-transparent to-transparent pointer-events-none" />

            <div className="relative p-8 sm:p-12 lg:p-16">
              <div className="flex flex-col items-center text-center">

                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white/95 text-xs font-bold mb-8 shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                  <span className="uppercase tracking-widest">{t('cta.badge')}</span>
                </motion.div>

                {/* Heading */}
                <motion.h2
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 }}
                  className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3rem] font-extrabold text-white leading-[1.1] tracking-tight max-w-3xl"
                >
                  <span className="inline-flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
                    <span className="inline-flex w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-white/25 to-white/10 items-center justify-center flex-shrink-0 ring-1 ring-white/30 shadow-lg">
                      <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/90 break-words">
                      {displayTitle}
                    </span>
                  </span>
                </motion.h2>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="text-base sm:text-lg md:text-xl text-white/80 mt-5 sm:mt-6 max-w-2xl mx-auto leading-relaxed"
                >
                  {displaySubtitle}
                </motion.p>

                {/* Feature pills */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25 }}
                  className="flex flex-wrap items-center justify-center gap-2 mt-8"
                >
                  {[
                    { icon: Clock, label: 'Source code included' },
                    { icon: CheckCircle2, label: 'Start whenever you’re ready' },
                    { icon: Shield, label: 'Secure access controls' },
                    { icon: Zap, label: 'Seeded demo included' },
                  ].map(({ icon: Icon, label }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/85 text-xs font-semibold backdrop-blur-sm">
                      <Icon className="w-3 h-3 text-teal-300 flex-shrink-0" />
                      {label}
                    </span>
                  ))}
                </motion.div>

                {/* CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="mt-10 flex flex-col xs:flex-row gap-4 justify-center items-stretch xs:items-center w-full max-w-md xs:max-w-none xs:w-auto"
                >
                  <Link href="/login" className="w-full xs:w-auto flex justify-center">
                    <motion.button
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className="group w-full xs:w-auto inline-flex items-center justify-center gap-2.5 px-9 py-4 rounded-2xl font-bold bg-white text-brand-800 shadow-xl shadow-black/20 hover:shadow-2xl hover:bg-teal-50 transition-all min-h-[52px] xs:min-w-[200px] text-[15px]"
                    >
                      <span>{t('cta.getStarted')}</span>
                      <ArrowRight className="w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                    </motion.button>
                  </Link>
                  <Link href="/contact" className="w-full xs:w-auto flex justify-center">
                    <motion.button
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full xs:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl font-bold border-2 border-white/40 text-white hover:bg-white/10 hover:border-white/60 transition-all min-h-[52px] xs:min-w-[200px] backdrop-blur-sm text-[15px]"
                    >
                      {t('cta.contactSales')}
                    </motion.button>
                  </Link>
                </motion.div>

                {/* Social proof strip */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="mt-10 pt-8 border-t border-white/10 w-full flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8"
                >
                  {/* Avatar stack */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2.5">
                      {[
                        'from-brand-400 to-teal-500',
                        'from-violet-400 to-purple-500',
                        'from-rose-400 to-pink-500',
                        'from-amber-400 to-orange-500',
                        'from-emerald-400 to-teal-500',
                      ].map((g, i) => (
                        <div key={i} className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} border-2 border-teal-800 flex-shrink-0 shadow`} />
                      ))}
                    </div>
                    <p className="text-white/70 text-sm"><span className="text-white font-bold">Full</span> source code license</p>
                  </div>
                  <div className="hidden sm:block w-px h-6 bg-white/15" />
                  {/* Neutral stats (no unverifiable claims) */}
                  {[
                    { value: 'Team-ready', label: 'ATS workflow' },
                    { value: 'Practical', label: 'day-to-day use' },
                    { value: 'Secure', label: 'role-based access' },
                  ].map(({ value, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-white font-extrabold text-base">{value}</span>
                      <span className="text-white/50 text-sm">{label}</span>
                    </div>
                  ))}
                </motion.div>

              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
      {/* --- Section: CTASection Root - end --- */}
    </>
  );
}
