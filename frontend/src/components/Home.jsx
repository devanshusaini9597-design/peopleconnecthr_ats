import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  motion, AnimatePresence, useScroll, useTransform,
  useMotionValue, useReducedMotion,
} from 'motion/react';
import {
  ArrowRight, Check, CheckCircle2, TrendingUp, Sparkles, Building2, Play, X,
} from 'lucide-react';
import {
  fadeUp, staggerContainer, Reveal, SpotlightCard, Magnetic,
} from './home/motionPrimitives';
import {
  USE_CASES, DEMO_VIDEO,
  COMPARISON, TOUR_TABS, PLAN_CAPS, WORKSPACE_MODULES, PRODUCT_SHOTS,
} from './home/homeData';
import { ProductFrame } from './home/ProductFrame';
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
            <motion.div style={prefersReduced ? undefined : { x: heroX, y: heroY }} className="w-full h-full bg-gradient-to-br from-brand-400/50 to-teal-500/50 rounded-full filter blur-[120px] opacity-80" />
          </div>
          <div className="absolute top-0 right-1/4 w-64 sm:w-96 h-64 sm:h-96 animate-blob animation-delay-2000">
            <motion.div style={prefersReduced ? undefined : { x: heroXInverse, y: heroYInverse }} className="w-full h-full bg-gradient-to-br from-teal-400/50 to-brand-500/50 rounded-full filter blur-[120px] opacity-70" />
          </div>
          <div className="absolute -bottom-32 left-1/2 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-br from-emerald-300/50 to-teal-400/50 rounded-full filter blur-[120px] opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full">
          <motion.div initial="hidden" animate="show" variants={staggerContainer}>
            <motion.div variants={fadeUp} className="mb-6 sm:mb-8">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center h-16 sm:h-[4.5rem] w-[min(320px,86vw)] rounded-2xl overflow-hidden bg-white border border-brand-200/50 shadow-lg shadow-brand-500/20"
                >
                  <img src="/logo.png" alt="People Connect HR" className="w-full h-full object-contain p-1" />
                </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} className="inline-flex mb-8 sm:mb-10 mx-auto overflow-visible">
              <div className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-brand-600 to-teal-700 text-white font-semibold text-sm shadow-xl shadow-brand-500/30 border border-brand-500/30">
                <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
                <span>Applicant tracking for teams that hire every week</span>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-400 to-teal-500 opacity-0 animate-ping" />
              </div>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-[2.15rem] leading-[1.15] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 sm:mb-8 text-stone-900 sm:leading-[1.08] break-words px-1">
              One workspace<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 via-teal-600 to-brand-800 bg-[length:200%_auto] animate-aurora">
                for the whole hire.
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-3 sm:mt-4 text-base sm:text-lg md:text-xl text-stone-600 max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed px-1">
              Jobs, candidates, interviews, careers pages, and mail live in one organization. Every workspace is limited by its plan: seats, open jobs, candidates, and emails this month.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-4 sm:gap-6 max-w-md sm:max-w-none mx-auto w-full">
              <Magnetic strength={0.25} className="w-full sm:w-auto">
                <Link
                  to="/register"
                  className="btn-cta-primary w-full sm:w-auto px-8 py-4 rounded-full text-base md:text-lg inline-flex justify-center shadow-2xl shadow-brand-500/40 hover:shadow-2xl hover:shadow-brand-500/50 transition-all"
                >
                  Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Magnetic>
              <Magnetic strength={0.25} className="w-full sm:w-auto">
                <a href="#video-demo" className="w-full sm:w-auto px-8 py-4 bg-white/95 border-2 border-stone-200 hover:border-brand-400 hover:bg-brand-50/70 text-stone-800 rounded-full font-semibold text-base md:text-lg transition-all shadow-xl shadow-stone-200/30 hover:shadow-xl hover:shadow-brand-500/20 flex items-center justify-center gap-3 backdrop-blur-md">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/30"
                  >
                    <Play className="w-5 h-5 text-white shrink-0 fill-white" />
                  </motion.div>
                  Watch Demo
                </a>
              </Magnetic>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-8 sm:mt-10 flex flex-wrap justify-center items-center gap-x-6 gap-y-3 text-sm text-stone-600 font-medium px-2">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-stone-200/80 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0" /> No credit card required
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-stone-200/80 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0" /> 21-day free trial
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-stone-200/80 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0" /> Cancel anytime
              </span>
            </motion.div>
          </motion.div>

          {/* Dashboard preview mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 sm:mt-16 lg:mt-20 relative px-0 lg:px-10 overflow-visible"
          >
            <div className="relative mx-auto max-w-5xl">
              <ProductFrame {...PRODUCT_SHOTS.dashboard} />
            </div>

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
                <div className="text-sm font-bold text-stone-900 leading-tight whitespace-nowrap">Plan usage, live</div>
                <div className="text-[11px] text-stone-500 whitespace-nowrap">Seats, jobs, candidates, mail</div>
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
                <div className="text-sm font-bold text-stone-900 leading-tight whitespace-nowrap">Mail included</div>
                <div className="text-[11px] text-stone-500 whitespace-nowrap">Replies go to your address</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Logo Cloud */}
      <section className="landing-section !py-12 sm:!py-16 relative z-10 bg-gradient-to-b from-white to-brand-50/30">
        <div className="max-w-6xl mx-auto landing-pad">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-8 mx-auto">
              <Building2 className="w-4 h-4 text-brand-600" />
              <span className="text-xs font-semibold text-brand-700 uppercase tracking-wider">Inside every workspace</span>
            </div>
          </Reveal>
          <Reveal stagger className="flex flex-wrap justify-center items-center gap-x-6 sm:gap-x-12 gap-y-4 sm:gap-y-6">
            {WORKSPACE_MODULES.map((name, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -4, scale: 1.05 }}
                className="px-6 py-3 rounded-2xl bg-white border border-stone-200/80 shadow-lg shadow-stone-200/50 hover:shadow-xl hover:shadow-brand-500/20 transition-all duration-300"
              >
                <span className="text-sm sm:text-base font-bold tracking-tight text-stone-600 hover:text-brand-700 transition-colors">
                  {name}
                </span>
              </motion.div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 sm:py-20 border-y border-stone-200/70 bg-gradient-to-br from-brand-50/50 via-white to-teal-50/50 backdrop-blur-sm relative z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-200/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto landing-pad relative">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6 mx-auto">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">What each plan includes</span>
            </div>
            <p className="text-center text-sm sm:text-base font-semibold text-stone-500 uppercase tracking-wider mb-10 sm:mb-12">
              The same ceilings the product enforces
            </p>
          </Reveal>
          <Reveal stagger className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-stretch">
            {PLAN_CAPS.map((row) => {
              const featured = row.plan === 'Premium';
              const cells = [
                ['Seats', row.seats],
                ['Open jobs', row.jobs],
                ['Candidates', row.candidates],
                ['Email', row.emails],
              ];
              return (
                <motion.div
                  key={row.plan}
                  variants={fadeUp}
                  whileHover={{ y: -6 }}
                  className={`relative overflow-hidden rounded-3xl border p-6 sm:p-7 shadow-xl ${
                    featured
                      ? 'border-brand-300 bg-gradient-to-br from-brand-600 to-teal-700 text-white shadow-brand-500/25'
                      : 'border-stone-200/80 bg-white text-stone-900 shadow-stone-200/50'
                  }`}
                >
                  <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${featured ? 'bg-white/20' : 'bg-brand-200/40'}`} />
                  <p className={`relative text-xs font-bold uppercase tracking-[0.18em] ${featured ? 'text-white/80' : 'text-brand-700'}`}>{row.plan}</p>
                  <div className="relative mt-5 grid grid-cols-2 gap-3">
                    {cells.map(([label, value]) => (
                      <div key={label} className={`rounded-2xl px-3 py-3 ${featured ? 'bg-white/10 ring-1 ring-white/15' : 'bg-stone-50 ring-1 ring-stone-100'}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${featured ? 'text-white/70' : 'text-stone-400'}`}>{label}</p>
                        <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
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

