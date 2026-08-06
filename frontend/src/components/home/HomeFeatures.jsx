import React from 'react';
import { motion } from 'motion/react';
import { Zap } from 'lucide-react';
import { Reveal, SpotlightCard } from './motionPrimitives';
import { FEATURES } from './homeData';

export function HomeFeatures() {
  return (
    <section id="features" className="landing-section relative z-10 bg-white/60 border-y border-stone-200/70">
      <div className="max-w-7xl mx-auto landing-pad">
        <Reveal className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <div className="section-eyebrow mb-4 mx-auto">
            <Zap className="w-3.5 h-3.5 shrink-0" /> Features
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">Everything you need to build your dream team</h2>
          <p className="text-base sm:text-lg md:text-xl text-stone-600">
            A complete toolkit designed to streamline your hiring process from sourcing to offering.
          </p>
        </Reveal>

        <Reveal
          stagger
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:grid-flow-row-dense gap-4 sm:gap-6"
        >
          {FEATURES.map((feature, idx) => (
            <SpotlightCard
              key={idx}
              className={`card-ats p-5 sm:p-8 hover:-translate-y-1 overflow-visible ${
                feature.big ? 'lg:col-span-2 lg:row-span-2' : ''
              }`}
            >
              <div className={`h-full flex flex-col min-w-0 ${feature.big ? 'justify-between' : ''}`}>
                <div className="min-w-0">
                  <motion.div
                    whileHover={{ rotate: 8, scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                    className="icon-box-ats mb-4 sm:mb-6"
                  >
                    {feature.icon}
                  </motion.div>
                  <h3 className={`font-semibold text-stone-900 mb-2 sm:mb-3 break-words ${feature.big ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'}`}>{feature.title}</h3>
                  <p className="text-stone-600 leading-relaxed text-sm sm:text-base break-words">{feature.desc}</p>
                </div>

                {feature.big && (
                  <div className="hidden md:grid grid-cols-5 gap-2 mt-8">
                    {[
                      { name: 'Applied', dot: 'bg-sky-500' },
                      { name: 'Screening', dot: 'bg-amber-500' },
                      { name: 'Interview', dot: 'bg-brand-500' },
                      { name: 'Offer', dot: 'bg-violet-500' },
                      { name: 'Hired', dot: 'bg-emerald-500' },
                    ].map((col, i) => (
                      <div key={i} className="bg-stone-50 rounded-lg border border-stone-100 p-2 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`}></span>
                          <span className="text-[10px] font-semibold text-stone-500 truncate">{col.name}</span>
                        </div>
                        <div className="h-8 bg-white rounded border border-stone-100"></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SpotlightCard>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
