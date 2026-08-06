import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  motion, AnimatePresence, useScroll, useTransform,
  useMotionValue, useReducedMotion,
} from 'motion/react';
import {
  LayoutDashboard, Users, Plug,
  ArrowRight, Zap, Check, Server,
  CheckCircle2, Mail,
  Star, Quote, TrendingUp, Clock, Sparkles, Building2, Rocket,
  Play, Film,
} from 'lucide-react';
import {
  fadeUp, staggerContainer, Reveal, SpotlightCard, TiltCard, Magnetic,
  CountUpStat, MiniAreaChart,
} from './home/motionPrimitives';
import {
  LOGO_CLOUD, USE_CASES, GUARANTEES, DEMO_VIDEO,
  INTEGRATIONS, TESTIMONIALS,
  FEATURES, STEPS, COMPARISON, TOUR_TABS, CHART_DATA,
} from './home/homeData';
import { ScrollToTopButton } from './home/ScrollToTopButton';
import { HomePageStyles } from './home/HomePageStyles';
import { HomeNav } from './home/HomeNav';
import { HomeFooter } from './home/HomeFooter';
import { HomeLandingSections } from './home/HomeLandingSections';

/* ============================================================
   Page
   ============================================================ */

const Home = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredLink, setHoveredLink] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);

  const { scrollYProgress } = useScroll();
  const prefersReduced = useReducedMotion();

  const heroX = useMotionValue(0);
  const heroY = useMotionValue(0);
  const heroXInverse = useTransform(heroX, (v) => -v);
  const heroYInverse = useTransform(heroY, (v) => -v);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 16);
      setShowScrollTop(y > 480);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  const handleHeroMouseMove = (e) => {
    if (prefersReduced) return;
    const { innerWidth, innerHeight } = window;
    heroX.set((e.clientX / innerWidth - 0.5) * 50);
    heroY.set((e.clientY / innerHeight - 0.5) * 50);
  };

  const activeTourTab = TOUR_TABS.find((t) => t.id === activeTab) || TOUR_TABS[0];

  useEffect(() => {
    if (!videoPlaying || DEMO_VIDEO.embedUrl) return;
    const id = setInterval(() => {
      setActiveChapter((c) => (c + 1) % DEMO_VIDEO.chapters.length);
    }, 3200);
    return () => clearInterval(id);
  }, [videoPlaying]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans overflow-x-clip">
      <HomePageStyles />

      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-brand-400 via-brand-600 to-teal-800 origin-left z-[60]"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Ambient mesh + grain */}
      <div className="pointer-events-none fixed inset-0 z-[1] landing-mesh opacity-90" />
      <div className="pointer-events-none fixed inset-0 z-[1] landing-dot-grid opacity-40" />
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.03] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />


      <HomeNav
        scrolled={scrolled}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        hoveredLink={hoveredLink}
        setHoveredLink={setHoveredLink}
      />

      {/* Hero */}
      <section
        onMouseMove={handleHeroMouseMove}
        className="relative pt-24 pb-14 sm:pt-32 sm:pb-20 lg:pt-44 lg:pb-28 overflow-x-clip overflow-y-visible min-h-0 sm:min-h-[85vh] lg:min-h-[92vh] flex items-center"
      >
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-64 sm:w-96 h-64 sm:h-96 animate-blob">
            <motion.div style={prefersReduced ? undefined : { x: heroX, y: heroY }} className="w-full h-full bg-brand-300/40 rounded-full filter blur-[120px] opacity-80" />
          </div>
          <div className="absolute top-0 right-1/4 w-64 sm:w-96 h-64 sm:h-96 animate-blob animation-delay-2000">
            <motion.div style={prefersReduced ? undefined : { x: heroXInverse, y: heroYInverse }} className="w-full h-full bg-teal-300/35 rounded-full filter blur-[120px] opacity-70" />
          </div>
          <div className="absolute -bottom-32 left-1/2 w-64 sm:w-96 h-64 sm:h-96 bg-emerald-200/35 rounded-full filter blur-[120px] opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full">
          <motion.div initial="hidden" animate="show" variants={staggerContainer}>
            <motion.div variants={fadeUp} className="mb-4 sm:mb-5">
              <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900">
                Skill<span className="text-gradient">Nix</span>
              </span>
            </motion.div>

            <motion.div variants={fadeUp} className="inline-flex mb-6 sm:mb-8 mx-auto overflow-visible">
              <div className="section-eyebrow relative pulse-ring">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>People Connect HR 2.0 — AI resume parsing is live</span>
              </div>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-[2.15rem] leading-[1.15] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-5 sm:mb-6 text-stone-900 sm:leading-[1.08] break-words px-1">
              Hire Smarter.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 via-teal-600 to-brand-800 bg-[length:200%_auto] animate-aurora">
                Scale Faster.
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-3 sm:mt-4 text-base sm:text-lg md:text-xl text-stone-600 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-1">
              The modern ATS that grows with your team. Track candidates, schedule interviews, and close hires — all in one workspace built like your dashboard.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-5 max-w-md sm:max-w-none mx-auto w-full">
              <Magnetic strength={0.25} className="w-full sm:w-auto">
                <Link
                  to="/register"
                  className="btn-cta-primary w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-full text-base md:text-lg inline-flex justify-center shadow-xl shadow-brand-500/30"
                >
                  Start Free Trial <ArrowRight className="ml-1 w-5 h-5" />
                </Link>
              </Magnetic>
              <Magnetic strength={0.25} className="w-full sm:w-auto">
                <a href="#video-demo" className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-white/90 border-2 border-stone-200 hover:border-brand-300 hover:bg-brand-50/60 text-stone-800 rounded-full font-semibold text-base md:text-lg transition-all shadow-sm flex items-center justify-center gap-2 backdrop-blur-sm">
                  <Play className="w-5 h-5 text-brand-600 shrink-0 fill-brand-600" />
                  Watch Demo
                </a>
              </Magnetic>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-6 sm:mt-8 flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-stone-500 font-medium px-2">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" /> No credit card</span>
              <span className="hidden sm:inline text-stone-300">·</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" /> 14-day free trial</span>
              <span className="hidden sm:inline text-stone-300">·</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" /> Cancel anytime</span>
            </motion.div>
          </motion.div>

          {/* Dashboard preview mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 sm:mt-16 lg:mt-20 relative px-0 lg:px-10 overflow-visible"
          >
            <TiltCard className="relative mx-auto max-w-5xl overflow-visible">
              <div className="shine-sweep bg-white p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-2xl shadow-stone-900/10 border border-stone-200/80 overflow-hidden text-left ring-1 ring-brand-500/5">
                <div className="rounded-lg sm:rounded-xl overflow-hidden border border-stone-100 flex min-w-0">
                  {/* Dark stone sidebar with teal accents — matches the real app shell */}
                  <div className="hidden md:flex flex-col w-44 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950 p-4 space-y-2.5 shrink-0 relative">
                    <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-teal-500/50 via-teal-500/10 to-transparent" />
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-teal-700 flex items-center justify-center shadow-md shadow-brand-500/30">
                        <LayoutDashboard className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="h-2.5 w-16 bg-white/25 rounded"></div>
                    </div>
                    <div className="flex items-center gap-2 h-8 px-2 rounded-lg bg-teal-500/15 border border-teal-400/20">
                      <div className="w-1 h-4 rounded-full bg-teal-400" />
                      <div className="h-2 w-16 bg-teal-300/40 rounded"></div>
                    </div>
                    <div className="h-7 w-full px-2 flex items-center"><div className="h-2 w-3/4 bg-white/10 rounded"></div></div>
                    <div className="h-7 w-full px-2 flex items-center"><div className="h-2 w-5/6 bg-white/10 rounded"></div></div>
                    <div className="h-7 w-full px-2 flex items-center"><div className="h-2 w-2/3 bg-white/10 rounded"></div></div>
                    <div className="mt-auto pt-4 border-t border-white/5">
                      <div className="h-2 w-12 bg-white/10 rounded mb-2"></div>
                      <div className="h-2 w-20 bg-white/10 rounded"></div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 bg-stone-50 p-3 sm:p-5 lg:p-6 space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <div className="h-2.5 sm:h-3 w-16 sm:w-24 bg-stone-200 rounded mb-1.5"></div>
                        <div className="h-3 sm:h-4 w-28 sm:w-40 max-w-full bg-stone-300/80 rounded"></div>
                      </div>
                      <div className="h-8 sm:h-9 w-16 sm:w-28 shrink-0 bg-gradient-to-r from-brand-600 to-teal-700 rounded-lg sm:rounded-xl shadow-md shadow-brand-500/20"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                      {[
                        { c: 'bg-sky-50', b: 'bg-sky-500', label: 'Open jobs' },
                        { c: 'bg-emerald-50', b: 'bg-emerald-500', label: 'Offers' },
                        { c: 'bg-brand-50', b: 'bg-brand-500', label: 'In pipeline' },
                      ].map((s, i) => (
                        <div key={i} className={`h-16 sm:h-24 ${s.c} rounded-xl sm:rounded-2xl border border-white/80 p-2 sm:p-3 flex flex-col justify-between shadow-sm`}>
                          <div className="h-2 w-1/2 bg-white/80 rounded"></div>
                          <div>
                            <div className={`h-2 sm:h-2.5 w-6 sm:w-10 rounded mb-1 ${s.b}`}></div>
                            <div className="hidden sm:block h-1.5 w-14 bg-white/60 rounded"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Mini kanban — 3 cols on mobile, 5 on sm+ */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2 pt-1">
                      {[
                        { name: 'Applied', dot: 'bg-sky-500', hideMobile: false },
                        { name: 'Screening', dot: 'bg-amber-500', hideMobile: false },
                        { name: 'Interview', dot: 'bg-brand-500', hideMobile: false },
                        { name: 'Offer', dot: 'bg-violet-500', hideMobile: true },
                        { name: 'Hired', dot: 'bg-emerald-500', hideMobile: true },
                      ].map((col, i) => (
                        <div key={i} className={`${col.hideMobile ? 'hidden sm:block' : ''} bg-white rounded-lg sm:rounded-xl border border-stone-200/80 shadow-sm p-1.5 sm:p-2 space-y-1 sm:space-y-1.5 hover:border-brand-200 transition-colors`}>
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dot}`}></span>
                            <div className="h-1.5 w-8 sm:w-10 max-w-full bg-stone-200 rounded"></div>
                          </div>
                          <div className="h-5 sm:h-7 bg-stone-50 rounded-md sm:rounded-lg border border-stone-100"></div>
                          {i < 3 && <div className="hidden sm:block h-5 sm:h-7 bg-stone-50/80 rounded-md sm:rounded-lg border border-stone-100"></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>

            {/* Floating stat chips for a premium modern-SaaS feel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.1 }}
              className="hidden lg:flex items-center gap-2 absolute left-0 top-16 bg-white rounded-xl shadow-xl border border-stone-200 px-4 py-3 animate-floaty z-20"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-stone-900 leading-tight whitespace-nowrap">Time-to-hire ↓ 38%</div>
                <div className="text-[11px] text-stone-500 whitespace-nowrap">vs. spreadsheet hiring</div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.3 }}
              className="hidden lg:flex items-center gap-2 absolute right-0 bottom-20 bg-white rounded-xl shadow-xl border border-stone-200 px-4 py-3 animate-floaty animation-delay-2000 z-20"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-brand-600" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-stone-900 leading-tight whitespace-nowrap">12 offers this week</div>
                <div className="text-[11px] text-stone-500 whitespace-nowrap">across 4 open reqs</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Logo Cloud */}
      <section className="landing-section !py-10 sm:!py-14 relative z-10">
        <div className="max-w-6xl mx-auto landing-pad">
          <Reveal>
            <p className="text-center text-[10px] sm:text-xs font-semibold text-stone-400 uppercase tracking-[0.18em] sm:tracking-[0.2em] mb-6 sm:mb-8 px-2">
              Trusted by hiring teams at
            </p>
          </Reveal>
          <Reveal stagger className="flex flex-wrap justify-center items-center gap-x-4 sm:gap-x-10 gap-y-3 sm:gap-y-5">
            {LOGO_CLOUD.map((name, i) => (
              <motion.span
                key={i}
                variants={fadeUp}
                whileHover={{ scale: 1.06, y: -2 }}
                className="text-sm sm:text-lg font-bold tracking-tight text-stone-300 hover:text-brand-600 transition-colors duration-300 cursor-default select-none px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:bg-brand-50/50"
              >
                {name}
              </motion.span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 sm:py-16 border-y border-stone-200/70 bg-white/70 backdrop-blur-sm relative z-10">
        <div className="max-w-7xl mx-auto landing-pad">
          <Reveal>
            <p className="text-center text-xs sm:text-sm font-semibold text-stone-500 uppercase tracking-wider mb-8 sm:mb-10">
              The numbers behind the switch
            </p>
          </Reveal>
          <Reveal stagger className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <CountUpStat end={50} suffix="K+" label="Candidates Tracked" icon={<Users size={20} className="text-brand-600" />} color="bg-brand-50 ring-1 ring-brand-100" />
            <CountUpStat end={10} suffix="K+" label="Hires Made" icon={<TrendingUp size={20} className="text-emerald-600" />} color="bg-emerald-50 ring-1 ring-emerald-100" />
            <CountUpStat end={99.9} suffix="%" decimals={1} label="Uptime" icon={<Server size={20} className="text-teal-700" />} color="bg-teal-50 ring-1 ring-teal-100" />
            <motion.div variants={fadeUp} className="flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-xl bg-amber-50 ring-1 ring-amber-100 flex items-center justify-center mb-3">
                <Clock size={20} className="text-amber-600" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-stone-900 mb-1">24/7</div>
              <div className="text-xs sm:text-sm text-stone-500 font-medium">Support</div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* Why teams switch */}
      <section className="landing-section relative z-10">
        <div className="max-w-6xl mx-auto landing-pad">
          <Reveal className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <div className="section-eyebrow mb-4 mx-auto">
              <Sparkles className="w-3.5 h-3.5 shrink-0" /> Why teams switch
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 tracking-tight px-1">From scattered inboxes to one real pipeline</h2>
          </Reveal>

          <Reveal stagger className="grid md:grid-cols-2 gap-4 sm:gap-6">
            <motion.div variants={fadeUp} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-8 shadow-[var(--shadow-card)]">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-400 mb-4 sm:mb-5 flex items-center gap-2">
                <X className="w-4 h-4 shrink-0" /> Before, with spreadsheets
              </h3>
              <ul className="space-y-3 sm:space-y-4">
                {COMPARISON.before.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-stone-600">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                      <X className="w-3 h-3 text-stone-400" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/80 to-white p-5 sm:p-8 relative overflow-hidden shadow-[var(--shadow-glow)]">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-300/25 rounded-full blur-3xl" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-brand-700 mb-4 sm:mb-5 relative flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> With People Connect HR
              </h3>
              <ul className="space-y-3 sm:space-y-4 relative">
                {COMPARISON.after.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-stone-800 font-medium">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-brand-700" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* Built for every team */}
      <section className="landing-section relative z-10">
        <div className="max-w-7xl mx-auto landing-pad">
          <Reveal className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <div className="section-eyebrow mb-4 mx-auto">
              <Building2 className="w-3.5 h-3.5 shrink-0" /> Use cases
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">Built for every kind of hiring team</h2>
            <p className="text-base sm:text-lg md:text-xl text-stone-600 mt-4">
              Whether you're hiring your first ten people or scaling recruiting across five brands.
            </p>
          </Reveal>

          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {USE_CASES.map((uc, i) => {
              const Icon = uc.icon;
              return (
                <SpotlightCard key={i} className="card-ats p-5 sm:p-7 h-full hover:-translate-y-1">
                  <div className="flex flex-col h-full">
                    <div className="icon-box-ats mb-4 sm:mb-5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-stone-900 mb-2">{uc.title}</h3>
                    <p className="text-stone-600 text-sm leading-relaxed flex-1">{uc.desc}</p>
                    <div className="mt-5 pt-4 border-t border-stone-100 text-xs font-semibold text-brand-700 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {uc.stat}
                    </div>
                  </div>
                </SpotlightCard>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* Features — bento grid */}
      {/* Mid-page sections */}
      <HomeLandingSections
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        videoPlaying={videoPlaying}
        setVideoPlaying={setVideoPlaying}
        activeChapter={activeChapter}
        setActiveChapter={setActiveChapter}
        prefersReduced={prefersReduced}
      />

      <HomeFooter />

      <ScrollToTopButton
        visible={showScrollTop}
        prefersReduced={prefersReduced}
        onClick={scrollToTop}
      />
    </div>
  );
};

export default Home;

