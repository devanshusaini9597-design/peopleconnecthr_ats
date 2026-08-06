import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Reveal, Magnetic, MiniAreaChart } from './motionPrimitives';
import { TOUR_TABS, CHART_DATA } from './homeData';

export function HomeProductTour({ activeTab, setActiveTab }) {
  const activeTourTab = TOUR_TABS.find((t) => t.id === activeTab) || TOUR_TABS[0];

  return (
    <section id="product-tour" className="landing-section relative z-10">
      <div className="max-w-6xl mx-auto landing-pad">
        <Reveal className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
          <div className="section-eyebrow mb-4 mx-auto">
            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" /> Product tour
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">Take a two-minute tour</h2>
          <p className="text-base sm:text-lg md:text-xl text-stone-600">The three screens your hiring team will live in every day.</p>
        </Reveal>

        <Reveal className="flex justify-center mb-8 sm:mb-10">
          <div className="tour-tabs-scroll">
            <div className="inline-flex items-center gap-1 p-1 sm:p-1.5 rounded-full bg-stone-100 border border-stone-200 min-w-max mx-auto">
              {TOUR_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-colors touch-target ${
                      active ? 'text-white' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="tour-tab-pill"
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-600 to-teal-700 shadow-md shadow-brand-500/25"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <Icon className="w-4 h-4 relative shrink-0" />
                    <span className="relative">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 items-start lg:items-center bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xl shadow-stone-900/5 p-4 sm:p-6 lg:p-10 ring-1 ring-brand-500/5 overflow-visible min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-4 sm:mb-5 break-words">{activeTourTab.heading}</h3>
              <ul className="space-y-3 sm:space-y-4">
                {activeTourTab.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-stone-600">
                    <CheckCircle2 className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                    <span className="min-w-0 break-words">{b}</span>
                  </li>
                ))}
              </ul>
              <Magnetic strength={0.2} className="mt-6 sm:mt-8 block w-full sm:w-auto">
                <Link to="/register" className="btn-cta-primary rounded-xl px-6 py-3 inline-flex w-full sm:w-auto justify-center">
                  Try it free <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Magnetic>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + '-visual'}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl bg-stone-50 border border-stone-200 p-3 sm:p-5 min-h-[220px] sm:min-h-[280px] flex items-center overflow-visible"
            >
              {activeTab === 'pipeline' && (
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3 w-full min-w-0">
                  {[
                    { name: 'Screening', short: 'Screen', dot: 'bg-amber-500', n: 3 },
                    { name: 'Interview', short: 'Interview', dot: 'bg-brand-500', n: 4 },
                    { name: 'Offer', short: 'Offer', dot: 'bg-violet-500', n: 2 },
                  ].map((col, i) => (
                    <div key={i} className="bg-white rounded-xl border border-stone-200 shadow-sm p-1.5 sm:p-2.5 space-y-1.5 sm:space-y-2 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1 min-w-0">
                        <span className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full shrink-0 ${col.dot}`}></span>
                        <span className="text-[10px] sm:text-xs font-bold text-stone-600 truncate">
                          <span className="sm:hidden">{col.short}</span>
                          <span className="hidden sm:inline">{col.name}</span>
                        </span>
                        <span className="ml-auto text-[10px] text-stone-400 font-semibold shrink-0">{col.n}</span>
                      </div>
                      {Array.from({ length: Math.min(col.n, 3) }).map((_, j) => (
                        <div key={j} className={`rounded-lg border border-stone-100 bg-stone-50 p-1.5 sm:p-2 space-y-1 ${j === 2 ? 'hidden sm:block' : ''}`}>
                          <div className="h-1.5 sm:h-2 w-3/4 bg-stone-200 rounded"></div>
                          <div className="h-1 sm:h-1.5 w-1/2 bg-stone-100 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'scheduling' && (
                <div className="w-full min-w-0">
                  <div className="flex items-center justify-between mb-3 px-1 gap-2">
                    <span className="text-xs font-bold text-stone-600">This week</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Synced
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 sm:gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
                      <div key={i} className="text-center min-w-0">
                        <div className="text-[9px] sm:text-[10px] font-semibold text-stone-400 mb-1.5">{d}</div>
                        <div className="rounded-md sm:rounded-lg bg-white border border-stone-200 h-16 sm:h-24 p-0.5 sm:p-1 space-y-1">
                          {i === 1 && <div className="h-3 sm:h-5 rounded bg-brand-100 border border-brand-200"></div>}
                          {i === 2 && <div className="h-3 sm:h-5 rounded bg-violet-100 border border-violet-200"></div>}
                          {i === 2 && <div className="h-3 sm:h-5 rounded bg-sky-100 border border-sky-200 hidden sm:block"></div>}
                          {i === 4 && <div className="h-3 sm:h-5 rounded bg-emerald-100 border border-emerald-200"></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="w-full min-w-0">
                  <div className="flex items-center justify-between mb-2 px-1 gap-2">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-600 truncate">Applications, last 6 months</span>
                    <span className="text-xs font-bold text-emerald-600 shrink-0">+131%</span>
                  </div>
                  <div className="h-32 sm:h-40 w-full">
                    <MiniAreaChart data={CHART_DATA} color="#0d9488" />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
