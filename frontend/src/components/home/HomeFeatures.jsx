import React from 'react';
import { motion } from 'motion/react';
import { Zap, Sparkles, ArrowRight } from 'lucide-react';
import { Reveal, SpotlightCard, Magnetic } from './motionPrimitives';
import { FEATURES } from './homeData';

export function HomeFeatures() {
  return (
    <section id="features" className="landing-section relative z-10 overflow-hidden">
      {/* Premium gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-brand-50/30 to-teal-50/30" />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-brand-200/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-7xl mx-auto landing-pad relative">
        <Reveal className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span className="text-sm font-semibold text-brand-700">Powerful Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">
            Everything you need to build your dream team
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-stone-600 leading-relaxed">
            A complete toolkit designed to streamline your hiring process from sourcing to offering.
          </p>
        </Reveal>

        <Reveal
          stagger
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:grid-flow-row-dense gap-6 sm:gap-8"
        >
          {FEATURES.map((feature, idx) => (
            <SpotlightCard
              key={idx}
              className={`relative group overflow-visible ${
                feature.big ? 'lg:col-span-2 lg:row-span-2' : ''
              }`}
            >
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`relative bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-stone-200/80 shadow-xl shadow-stone-200/50 overflow-hidden h-full ${
                  feature.big ? 'flex flex-col justify-between' : 'flex flex-col'
                }`}
              >
                {/* Premium hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10 min-w-0">
                  <motion.div
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/30 mb-6 ${
                      feature.big ? 'lg:w-20 lg:h-20' : ''
                    }`}
                  >
                    {feature.icon}
                  </motion.div>
                  <h3 className={`font-bold text-stone-900 mb-3 break-words ${feature.big ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>{feature.title}</h3>
                  <p className="text-stone-600 leading-relaxed text-sm sm:text-base break-words">{feature.desc}</p>
                </div>

                {feature.big && (
                  <div className="hidden md:grid grid-cols-5 gap-3 mt-8 relative z-10">
                    {[
                      { name: 'Applied', dot: 'bg-sky-500', count: '24' },
                      { name: 'Screening', dot: 'bg-amber-500', count: '12' },
                      { name: 'Interview', dot: 'bg-brand-500', count: '8' },
                      { name: 'Offer', dot: 'bg-violet-500', count: '3' },
                      { name: 'Hired', dot: 'bg-emerald-500', count: '1' },
                    ].map((col, i) => (
                      <motion.div
                        key={i}
                        whileHover={{ y: -4 }}
                        className="bg-gradient-to-br from-stone-50 to-white rounded-xl border border-stone-200/80 p-3 space-y-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 animate-pulse rounded-full ${col.dot}`}></span>
                            <span className="text-xs font-semibold text-stone-600">{col.name}</span>
                          </div>
                          <span className="text-lg font-bold text-stone-900">{col.count}</span>
                        </div>
                        <div className="h-10 bg-white rounded-lg border border-stone-100 flex items-center justify-center">
                          <div className="w-1 h-6 bg-stone-200 rounded-full" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </SpotlightCard>
          ))}
        </Reveal>

        <Reveal className="mt-12 sm:mt-16 text-center">
          <Magnetic strength={0.15} className="inline-block">
            <a
              href="#product-tour"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-600 to-teal-700 text-white font-semibold rounded-2xl shadow-xl shadow-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/40 transition-all duration-300"
            >
              <span>See All Features</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </Magnetic>
        </Reveal>
      </div>
    </section>
  );
}
