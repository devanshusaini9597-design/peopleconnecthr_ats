import React from 'react';
import { motion } from 'motion/react';
import { Building2, Users, Briefcase, Award, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { Reveal, SpotlightCard, fadeUp, Magnetic } from './motionPrimitives';
import { INDUSTRY_SOLUTIONS } from './homeData';

export function IndustrySolutions() {
  return (
    <section id="industries" className="landing-section relative z-10 overflow-hidden">
      {/* Premium gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-white to-teal-50/50" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-7xl mx-auto landing-pad relative">
        <Reveal className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span className="text-sm font-semibold text-brand-700">Industry Solutions</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">
            Built for every industry
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-stone-600 leading-relaxed">
            Specialized hiring workflows tailored to your industry's unique requirements
          </p>
        </Reveal>

        <Reveal stagger className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {INDUSTRY_SOLUTIONS.map((solution, i) => {
            const Icon = solution.icon;
            return (
              <SpotlightCard key={i} className="relative group">
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="relative bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-stone-200/80 shadow-xl shadow-stone-200/50 overflow-hidden"
                >
                  {/* Premium hover gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/30"
                      >
                        <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                      </motion.div>
                      <div className="flex-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-1">{solution.title}</h3>
                        <div className="h-1 w-16 bg-gradient-to-r from-brand-500 to-teal-500 rounded-full" />
                      </div>
                    </div>
                    
                    <p className="text-stone-600 text-sm sm:text-base leading-relaxed flex-1 mb-6">
                      {solution.desc}
                    </p>
                    
                    <div className="pt-6 border-t border-stone-100">
                      <p className="text-xs sm:text-sm font-semibold text-stone-500 mb-3 uppercase tracking-wider">
                        Common roles we help hire
                      </p>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        {solution.roles.map((role, idx) => (
                          <motion.span
                            key={idx}
                            whileHover={{ scale: 1.05 }}
                            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-brand-700 bg-gradient-to-r from-brand-50 to-teal-50 border border-brand-200/50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full"
                          >
                            <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                            {role}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </SpotlightCard>
            );
          })}
        </Reveal>

        <Reveal className="mt-12 sm:mt-16 text-center">
          <Magnetic strength={0.15} className="inline-block">
            <a
              href="#demo"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-600 to-teal-700 text-white font-semibold rounded-2xl shadow-xl shadow-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/40 transition-all duration-300"
            >
              <span>Explore Your Industry</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </Magnetic>
        </Reveal>
      </div>
    </section>
  );
}
