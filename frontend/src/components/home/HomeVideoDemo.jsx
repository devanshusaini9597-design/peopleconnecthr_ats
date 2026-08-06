import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Film, Play } from 'lucide-react';
import { Reveal, Magnetic, MiniAreaChart } from './motionPrimitives';
import { DEMO_VIDEO, CHART_DATA } from './homeData';

export function HomeVideoDemo({
  videoPlaying, setVideoPlaying, activeChapter, setActiveChapter,
}) {
  return (
    <section id="video-demo" className="landing-section relative z-10 bg-stone-950 text-white overflow-hidden">
      <div className="absolute inset-0 landing-dot-grid opacity-20 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-teal-400/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto landing-pad relative">
        <Reveal className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-brand-200 text-xs font-semibold mb-4">
            <Film className="w-3.5 h-3.5" /> Watch the demo
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 tracking-tight text-white">
            See People Connect HR in action
          </h2>
          <p className="text-base sm:text-lg text-stone-400">
            A quick walkthrough of the pipeline, scheduling, and analytics your team will live in every day.
          </p>
        </Reveal>

        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <Reveal className="lg:col-span-8">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-stone-900 shadow-2xl shadow-brand-500/10 ring-1 ring-white/5">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-stone-900/80">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                <div className="ml-3 flex-1 h-6 rounded-md bg-white/5 border border-white/10 flex items-center px-3">
                  <span className="text-[11px] text-stone-500 truncate">app.skillnix.com / demo</span>
                </div>
                <span className="hidden sm:inline text-[11px] font-semibold text-stone-500 tabular-nums">{DEMO_VIDEO.duration}</span>
              </div>

              <div className="relative aspect-video bg-gradient-to-br from-stone-900 via-stone-950 to-brand-950">
                {videoPlaying && DEMO_VIDEO.embedUrl ? (
                  <iframe
                    title={DEMO_VIDEO.title}
                    src={`${DEMO_VIDEO.embedUrl}${DEMO_VIDEO.embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 p-4 sm:p-8 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs font-semibold text-brand-300 uppercase tracking-wider mb-1">
                            {DEMO_VIDEO.chapters[activeChapter]?.label || 'Product preview'}
                          </p>
                          <p className="text-sm text-stone-400">{DEMO_VIDEO.title}</p>
                        </div>
                        {videoPlaying && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live preview
                          </span>
                        )}
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={videoPlaying ? activeChapter : 'poster'}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.35 }}
                          className="flex-1 rounded-xl border border-white/10 bg-stone-50/95 overflow-hidden min-h-0"
                        >
                          {(!videoPlaying || activeChapter === 0) && (
                            <div className="h-full p-3 sm:p-4 grid grid-cols-3 gap-2">
                              {[
                                { name: 'Screening', n: 3, dot: 'bg-amber-500' },
                                { name: 'Interview', n: 4, dot: 'bg-brand-500' },
                                { name: 'Offer', n: 2, dot: 'bg-violet-500' },
                              ].map((col) => (
                                <div key={col.name} className="bg-white rounded-lg border border-stone-200 p-2 space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                                    <span className="text-[10px] font-bold text-stone-600 truncate">{col.name}</span>
                                    <span className="ml-auto text-[10px] text-stone-400">{col.n}</span>
                                  </div>
                                  {Array.from({ length: Math.min(col.n, 3) }).map((_, j) => (
                                    <div key={j} className="h-8 rounded-md bg-stone-50 border border-stone-100" />
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                          {videoPlaying && activeChapter === 1 && (
                            <div className="h-full p-4">
                              <div className="grid grid-cols-5 gap-2 h-full">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
                                  <div key={d} className="bg-white rounded-lg border border-stone-200 p-1.5">
                                    <div className="text-[10px] font-bold text-stone-400 text-center mb-2">{d}</div>
                                    {i === 1 && <div className="h-8 rounded bg-brand-100 border border-brand-200 mb-1" />}
                                    {i === 2 && <div className="h-8 rounded bg-teal-100 border border-teal-200 mb-1" />}
                                    {i === 4 && <div className="h-8 rounded bg-emerald-100 border border-emerald-200" />}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {videoPlaying && activeChapter === 2 && (
                            <div className="h-full p-5 flex flex-col justify-center gap-3">
                              {['Culture fit', 'Problem solving', 'Communication'].map((row, i) => (
                                <div key={row} className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 px-4 py-3">
                                  <span className="text-sm font-semibold text-stone-700 w-32 shrink-0">{row}</span>
                                  <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${70 + i * 10}%` }}
                                      transition={{ duration: 0.8, delay: 0.1 }}
                                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-600"
                                    />
                                  </div>
                                  <span className="text-sm font-bold text-brand-700 tabular-nums">{4 + i}/5</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {videoPlaying && activeChapter === 3 && (
                            <div className="h-full p-5 flex flex-col">
                              <div className="flex justify-between mb-3">
                                <span className="text-xs font-bold text-stone-600">Applications · 6 mo</span>
                                <span className="text-xs font-bold text-emerald-600">+131%</span>
                              </div>
                              <div className="flex-1 min-h-0">
                                <MiniAreaChart data={CHART_DATA} color="#0d9488" />
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {!videoPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-stone-950/35 backdrop-blur-[2px]">
                        <Magnetic strength={0.2}>
                          <button
                            type="button"
                            onClick={() => { setVideoPlaying(true); setActiveChapter(0); }}
                            className="group relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white text-brand-700 shadow-2xl shadow-brand-500/30 hover:scale-105 transition-transform"
                            aria-label="Play demo video"
                          >
                            <span className="absolute inset-0 rounded-full border-2 border-white/40 animate-ping opacity-30" />
                            <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-current ml-1" />
                          </button>
                        </Magnetic>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="px-4 py-3 border-t border-white/10 flex items-center gap-3 bg-stone-900/90">
                <button
                  type="button"
                  onClick={() => setVideoPlaying((v) => !v)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
                  aria-label={videoPlaying ? 'Pause' : 'Play'}
                >
                  {videoPlaying ? (
                    <span className="flex gap-0.5"><span className="w-1 h-3 bg-white rounded-sm" /><span className="w-1 h-3 bg-white rounded-sm" /></span>
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                  )}
                </button>
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-teal-400"
                    animate={{ width: videoPlaying ? `${((activeChapter + 1) / DEMO_VIDEO.chapters.length) * 100}%` : '8%' }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-stone-400 tabular-nums">{DEMO_VIDEO.duration}</span>
              </div>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1 px-1">Chapters</p>
            {DEMO_VIDEO.chapters.map((ch, i) => {
              const Icon = ch.icon;
              const active = videoPlaying && activeChapter === i;
              return (
                <button
                  key={ch.label}
                  type="button"
                  onClick={() => { setVideoPlaying(true); setActiveChapter(i); }}
                  className={`w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                    active
                      ? 'bg-brand-500/15 border-brand-400/40 shadow-lg shadow-brand-500/10'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    active ? 'bg-gradient-to-br from-brand-500 to-teal-700 text-white' : 'bg-white/10 text-stone-300'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold truncate ${active ? 'text-white' : 'text-stone-200'}`}>{ch.label}</div>
                    <div className="text-[11px] text-stone-500 font-medium tabular-nums">{ch.t}</div>
                  </div>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse shrink-0" />}
                </button>
              );
            })}

            <Magnetic strength={0.15} className="w-full pt-2">
              <Link to="/register" className="btn-cta-primary w-full justify-center rounded-xl !py-3">
                Start free trial <ArrowRight className="w-4 h-4" />
              </Link>
            </Magnetic>
            <a href="#demo" className="block text-center text-sm font-medium text-stone-400 hover:text-white transition-colors py-2">
              Prefer a live walkthrough? Book a demo →
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
