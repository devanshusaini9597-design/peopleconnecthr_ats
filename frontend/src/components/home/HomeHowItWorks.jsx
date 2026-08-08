import React from 'react';
import { motion } from 'motion/react';
import { Plug, Rocket, Quote, Star } from 'lucide-react';
import { fadeUp, Reveal, SpotlightCard } from './motionPrimitives';
import { STEPS, INTEGRATIONS, TESTIMONIALS, GUARANTEES } from './homeData';

export function HomeHowItWorks() {
  return (
    <section id="how-it-works" className="landing-section bg-white/70 border-y border-stone-200/70 relative z-10">
      <div className="max-w-7xl mx-auto landing-pad">
        <Reveal className="text-center mb-10 sm:mb-16">
          <div className="section-eyebrow mb-4 mx-auto">
            <Rocket className="w-3.5 h-3.5 shrink-0" /> How it works
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">How it works</h2>
          <p className="text-base sm:text-lg md:text-xl text-stone-600">Three simple steps to supercharge your hiring.</p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-8 sm:gap-12 relative">
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-stone-200 overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
              className="h-full w-full bg-gradient-to-r from-brand-500 via-teal-500 to-brand-700 origin-left"
            />
          </div>

          {STEPS.map((item, idx) => (
            <Reveal key={idx} className="relative z-10" transition={{ duration: 0.7, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}>
              <div className="flex flex-col items-center text-center px-2 min-w-0">
                <motion.div
                  whileHover={{ scale: 1.08, boxShadow: '0 12px 24px -8px rgba(13,148,136,0.35)' }}
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-white flex items-center justify-center text-2xl sm:text-3xl font-bold text-brand-600 mb-4 sm:mb-6 border border-brand-100 shadow-md shadow-brand-500/10"
                >
                  {item.step}
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-semibold text-stone-900 mb-3 sm:mb-4 break-words">{item.title}</h3>
                <p className="text-sm sm:text-base text-stone-600 leading-relaxed break-words max-w-sm">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeIntegrations() {
  return (
    <section id="integrations" className="landing-section relative z-10">
      <div className="max-w-7xl mx-auto landing-pad">
        <Reveal className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="section-eyebrow mb-4 mx-auto">
            <Plug className="w-3.5 h-3.5 shrink-0" /> Integrations
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">Works with the tools you already use</h2>
          <p className="text-base sm:text-lg md:text-xl text-stone-600">
            Bring your own accounts and keys. Nothing routes through a third party you don't control.
          </p>
        </Reveal>
      </div>

      <Reveal>
        <div className="marquee-track overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <div className="flex gap-3 sm:gap-4 w-max animate-marquee py-2">
            {[...INTEGRATIONS, ...INTEGRATIONS].map((item, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05, y: -2, borderColor: 'rgb(153 246 228)' }}
                className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-white border border-stone-200 rounded-2xl shadow-[var(--shadow-card)] shrink-0"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-brand-50 to-teal-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                  {item.icon}
                </div>
                <span className="font-medium text-stone-700 whitespace-nowrap text-sm sm:text-base">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function HomeTestimonials() {
  return (
    <>
      <section id="testimonials" className="landing-section bg-white/70 border-y border-stone-200/70 relative z-10">
        <div className="max-w-7xl mx-auto landing-pad">
          <Reveal className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <div className="section-eyebrow mb-4 mx-auto">
              <Quote className="w-3.5 h-3.5 shrink-0" /> Testimonials
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">Recruiting teams that switched, and stayed</h2>
            <p className="text-base sm:text-lg md:text-xl text-stone-600">A few words from people who used to run hiring out of a spreadsheet.</p>
          </Reveal>

          <Reveal stagger className="grid md:grid-cols-3 gap-4 sm:gap-8">
            {TESTIMONIALS.map((t, i) => (
              <SpotlightCard key={i} className="card-ats p-5 sm:p-8 flex flex-col">
                <Quote className="w-7 h-7 sm:w-8 sm:h-8 text-brand-200 mb-3 sm:mb-4" />
                <div className="flex gap-0.5 mb-3 sm:mb-4">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} size={16} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-stone-700 leading-relaxed flex-1 mb-5 sm:mb-6 text-sm sm:text-base break-words">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-5 sm:pt-6 border-t border-stone-100 min-w-0">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-600 to-teal-700 flex items-center justify-center text-white font-semibold shrink-0 shadow-md shadow-brand-500/25"
                  >
                    {t.name.charAt(0)}
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-stone-900 text-sm">{t.name}</div>
                    <div className="text-stone-500 text-xs break-words">{t.role}, {t.company}</div>
                  </div>
                </div>
              </SpotlightCard>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="py-10 sm:py-14 bg-brand-50/60 border-y border-brand-100 relative z-10">
        <div className="max-w-6xl mx-auto landing-pad">
          <Reveal stagger className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {GUARANTEES.map((g, i) => {
              const Icon = g.icon;
              return (
                <motion.div key={i} variants={fadeUp} className="flex items-start gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-brand-100">
                    <Icon className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-stone-900 mb-1 text-sm sm:text-base">{g.title}</h4>
                    <p className="text-sm text-stone-600">{g.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </Reveal>
        </div>
      </section>
    </>
  );
}
