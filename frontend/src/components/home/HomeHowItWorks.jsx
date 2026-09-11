import React from 'react';
import { motion } from 'motion/react';
import { Plug, Rocket, Quote, Star, Sparkles, ArrowRight } from 'lucide-react';
import { fadeUp, Reveal, SpotlightCard, Magnetic } from './motionPrimitives';
import { STEPS, INTEGRATIONS, TESTIMONIALS, GUARANTEES } from './homeData';

export function HomeHowItWorks() {
  return (
    <section id="how-it-works" className="landing-section relative z-10 overflow-hidden">
      {/* Premium gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-white to-teal-50/50" />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-brand-200/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-7xl mx-auto landing-pad relative">
        <Reveal className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6">
            <Rocket className="w-4 h-4 text-brand-600" />
            <span className="text-sm font-semibold text-brand-700">How it works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">
            Three simple steps to supercharge your hiring
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-stone-600 leading-relaxed">
            Get started in minutes and transform your recruitment process
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-8 sm:gap-12 relative">
          <div className="hidden md:block absolute top-20 left-[15%] right-[15%] h-1 bg-stone-200 overflow-hidden">
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
              <motion.div
                whileHover={{ y: -8 }}
                className="flex flex-col items-center text-center px-4"
              >
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-3xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-3xl sm:text-4xl font-bold text-white mb-6 shadow-xl shadow-brand-500/30"
                >
                  {item.step}
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4 break-words">{item.title}</h3>
                <p className="text-sm sm:text-base text-stone-600 leading-relaxed break-words max-w-sm">{item.desc}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 sm:mt-16 text-center">
          <Magnetic strength={0.15} className="inline-block">
            <a
              href="#demo"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-600 to-teal-700 text-white font-semibold rounded-2xl shadow-xl shadow-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/40 transition-all duration-300"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </Magnetic>
        </Reveal>
      </div>
    </section>
  );
}

export function HomeIntegrations() {
  return (
    <section id="integrations" className="landing-section relative z-10 overflow-hidden">
      {/* Premium gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-brand-50/30 to-teal-50/30" />
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-brand-200/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-7xl mx-auto landing-pad relative">
        <Reveal className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6">
            <Plug className="w-4 h-4 text-brand-600" />
            <span className="text-sm font-semibold text-brand-700">Integrations</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">
            Works with the tools you already use
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-stone-600 leading-relaxed">
            Bring your own accounts and keys. Nothing routes through a third party you don't control.
          </p>
        </Reveal>
      </div>

      <Reveal>
        <div className="marquee-track overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <div className="flex gap-4 sm:gap-6 w-max animate-marquee py-4">
            {[...INTEGRATIONS, ...INTEGRATIONS].map((item, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -4, scale: 1.05 }}
                className="flex items-center gap-3 sm:gap-4 px-5 sm:px-7 py-4 sm:py-5 bg-white border border-stone-200/80 rounded-2xl shadow-xl shadow-stone-200/50 hover:shadow-2xl hover:shadow-brand-500/20 shrink-0 transition-all duration-300"
              >
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-500/30"
                >
                  {item.icon}
                </motion.div>
                <span className="font-semibold text-stone-700 whitespace-nowrap text-sm sm:text-base">{item.label}</span>
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
      <section id="testimonials" className="landing-section relative z-10 overflow-hidden">
        {/* Premium gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-white to-teal-50/50" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-brand-200/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto landing-pad relative">
          <Reveal className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6">
              <Quote className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">Testimonials</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">
              Recruiting teams that switched, and stayed
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-stone-600 leading-relaxed">
              A few words from people who used to run hiring out of a spreadsheet.
            </p>
          </Reveal>

          <Reveal stagger className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {TESTIMONIALS.map((t, i) => (
              <SpotlightCard key={i} className="relative group">
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="relative bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-stone-200/80 shadow-xl shadow-stone-200/50 overflow-hidden flex flex-col h-full"
                >
                  {/* Premium hover gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <Quote className="w-8 h-8 sm:w-10 sm:h-10 text-brand-200 mb-4 sm:mb-5" />
                    <div className="flex gap-1 mb-4 sm:mb-5">
                      {[...Array(5)].map((_, s) => (
                        <Star key={s} size={18} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-stone-700 leading-relaxed flex-1 mb-6 sm:mb-8 text-sm sm:text-base break-words font-medium">"{t.quote}"</p>
                    <div className="flex items-center gap-4 pt-6 sm:pt-8 border-t border-stone-100 min-w-0">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ duration: 0.3 }}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-teal-700 flex items-center justify-center text-white font-bold text-lg sm:text-xl shrink-0 shadow-lg shadow-brand-500/30"
                      >
                        {t.name.charAt(0)}
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-stone-900 text-sm sm:text-base">{t.name}</div>
                        <div className="text-stone-500 text-xs sm:text-sm break-words">{t.role}, {t.company}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </SpotlightCard>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-gradient-to-r from-brand-50 to-teal-50 border-y border-brand-100/50 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-100/20 to-teal-100/20" />
        <div className="max-w-6xl mx-auto landing-pad relative">
          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {GUARANTEES.map((g, i) => {
              const Icon = g.icon;
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ y: -4 }}
                  className="flex items-start gap-4 bg-white/80 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-brand-100/50 shadow-lg shadow-brand-500/10"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30">
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-stone-900 mb-1.5 text-sm sm:text-base">{g.title}</h4>
                    <p className="text-sm text-stone-600 leading-relaxed">{g.desc}</p>
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
