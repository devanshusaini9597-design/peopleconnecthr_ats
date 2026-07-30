import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, FileText, Plug, BarChart3,
  Menu, X, ChevronDown, Lock, Shield, Server, ArrowRight, Zap, Check,
  Briefcase, CheckCircle2, Mail, MessageSquare, Webhook, FileSignature,
  Star, Quote
} from 'lucide-react';

/* ---------- Scroll-reveal (unchanged utility, theme-independent) ---------- */
const useScrollAnimation = () => {
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-8');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => { if (ref.current) observer.unobserve(ref.current); };
  }, []);

  return ref;
};

const AnimatedSection = ({ children, className = '', delay = 0 }) => {
  const ref = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out opacity-0 translate-y-8 ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

/* ---------- Animated count-up stat ---------- */
const useInView = (threshold = 0.4) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(node);
        }
      },
      { threshold }
    );
    observer.observe(node);
    return () => observer.unobserve(node);
  }, [threshold]);

  return [ref, inView];
};

const CountUpStat = ({ end, suffix = '', decimals = 0, duration = 1500, label }) => {
  const [ref, inView] = useInView();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(end);
      return;
    }
    let start = null;
    let frame;
    const step = (timestamp) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(end * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else setValue(end);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, end, duration]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl font-bold text-gray-900 mb-1 tabular-nums">
        {value.toFixed(decimals)}{suffix}
      </div>
      <div className="text-sm text-gray-500 font-medium">{label}</div>
    </div>
  );
};

/* ---------- Data ---------- */
const INTEGRATIONS = [
  { icon: <Mail size={20} />, label: 'Email — SMTP / SendGrid / Zoho' },
  { icon: <Calendar size={20} />, label: 'Calendar — Google / Outlook' },
  { icon: <MessageSquare size={20} />, label: 'Team chat notifications' },
  { icon: <FileSignature size={20} />, label: 'E-signature for offer letters' },
  { icon: <Webhook size={20} />, label: 'Webhooks & open API' },
  { icon: <Plug size={20} />, label: 'Bring your own API keys' },
];

const TESTIMONIALS = [
  {
    quote: "We went from a shared spreadsheet to a real pipeline in an afternoon. Our recruiters actually know who's supposed to move next.",
    name: 'Priya N.',
    role: 'Head of Talent',
    company: 'Northwind Robotics',
  },
  {
    quote: "The BYOK setup meant IT didn't have to fight our security team. We plugged in our own email account and were sending in ten minutes.",
    name: 'Marcus O.',
    role: 'Recruiting Lead',
    company: 'BlueOrbit Labs',
  },
  {
    quote: 'Scorecards ended the "vibes-based" hiring debates in our team. Now every interview panel is on the same page before the debrief.',
    name: 'Elena V.',
    role: 'People Ops Manager',
    company: 'Cascade Analytics',
  },
];

const Home = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 9s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 26s linear infinite; }
        .marquee-track:hover .animate-marquee { animation-play-state: paused; }

        @media (prefers-reduced-motion: reduce) {
          .animate-blob, .animate-float, .animate-marquee { animation: none; }
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-sm">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                SkillNix
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">How it Works</a>
              <a href="#integrations" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Integrations</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
              <a href="#faq" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-4 py-2">
                Login
              </Link>
              <Link to="/register" className="text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-full transition-all shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35">
                Start Free Trial
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 absolute top-20 left-0 w-full shadow-lg">
            <div className="px-4 pt-2 pb-6 space-y-2">
              <a href="#features" className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
              <a href="#integrations" className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Integrations</a>
              <a href="#pricing" className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#faq" className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <Link to="/login" className="block w-full text-center px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">Login</Link>
                <Link to="/register" className="block w-full text-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white font-medium">Start Free Trial</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-[90vh] flex items-center">
        {/* Soft ambient background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/50 rounded-full filter blur-[120px] opacity-70 animate-blob"></div>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-200/50 rounded-full filter blur-[120px] opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-cyan-200/40 rounded-full filter blur-[120px] opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <div className="inline-flex items-center px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium mb-8">
              <Zap className="w-4 h-4 mr-2" />
              <span>SkillNix 2.0 is now live</span>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-gray-900">
              Hire Smarter.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Scale Faster.</span>
            </h1>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto mb-10 leading-relaxed">
              The modern ATS that grows with your team. Track candidates, schedule interviews, and close hires — all in one beautifully designed workspace.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={300}>
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full font-medium text-lg transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:-translate-y-1 flex items-center justify-center">
                Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <a href="#demo" className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 rounded-full font-medium text-lg transition-all shadow-sm flex items-center justify-center">
                Book a Demo
              </a>
            </div>
            <p className="mt-6 text-sm text-gray-500 font-medium">
              No credit card required · Free 14-day trial · Cancel anytime
            </p>
          </AnimatedSection>

          {/* Dashboard preview mockup — echoes the real product theme */}
          <AnimatedSection delay={500} className="mt-20">
            <div className="relative mx-auto max-w-5xl animate-float">
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 bottom-0 h-32 mt-auto"></div>
              <div className="bg-white p-2 rounded-2xl shadow-2xl border border-gray-200 overflow-hidden text-left">
                <div className="rounded-xl overflow-hidden border border-gray-100 flex">
                  {/* mini sidebar */}
                  <div className="hidden md:flex flex-col w-40 bg-gradient-to-b from-blue-900 to-blue-800 p-4 space-y-3 shrink-0">
                    <div className="h-6 w-24 bg-blue-400/40 rounded"></div>
                    <div className="h-3 w-full bg-white/20 rounded mt-4"></div>
                    <div className="h-3 w-3/4 bg-white/10 rounded"></div>
                    <div className="h-3 w-5/6 bg-white/10 rounded"></div>
                    <div className="h-3 w-2/3 bg-white/10 rounded"></div>
                  </div>
                  {/* mini content */}
                  <div className="flex-1 bg-gray-50 p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-40 bg-gray-200 rounded"></div>
                      <div className="h-8 w-24 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { c: 'bg-blue-50', b: 'bg-blue-500' },
                        { c: 'bg-emerald-50', b: 'bg-emerald-500' },
                        { c: 'bg-violet-50', b: 'bg-violet-500' },
                      ].map((s, i) => (
                        <div key={i} className={`h-24 ${s.c} rounded-xl border border-gray-100 p-3 flex flex-col justify-between`}>
                          <div className="h-2.5 w-1/2 bg-white/70 rounded"></div>
                          <div className={`h-2.5 w-8 rounded ${s.b}`}></div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-3 pt-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 shadow-sm"></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Trusted By / Stats */}
      <section className="py-16 border-y border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-10">
              Trusted by 500+ innovative companies
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <CountUpStat end={50} suffix="K+" label="Candidates Tracked" />
              <CountUpStat end={10} suffix="K+" label="Hires Made" />
              <CountUpStat end={99.9} suffix="%" decimals={1} label="Uptime" />
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 mb-1">24/7</div>
                <div className="text-sm text-gray-500 font-medium">Support</div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">Everything you need to build your dream team</h2>
            <p className="text-xl text-gray-600">
              A complete toolkit designed to streamline your hiring process from sourcing to offering.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: <LayoutDashboard className="w-6 h-6" />, title: 'Visual Pipeline', desc: 'Drag-and-drop kanban boards for every job. See where every candidate stands at a glance.', bg: 'bg-blue-50', color: 'text-blue-600' },
              { icon: <Calendar className="w-6 h-6" />, title: 'Smart Scheduling', desc: 'One-click interview scheduling with calendar sync. No more back-and-forth emails.', bg: 'bg-violet-50', color: 'text-violet-600' },
              { icon: <Users className="w-6 h-6" />, title: 'Team Collaboration', desc: 'Share feedback, assign tasks, and collaborate with your hiring team in real-time.', bg: 'bg-cyan-50', color: 'text-cyan-600' },
              { icon: <FileText className="w-6 h-6" />, title: 'Resume Parsing', desc: 'AI-powered resume parsing extracts skills, experience, and contact info automatically.', bg: 'bg-pink-50', color: 'text-pink-600' },
              { icon: <Plug className="w-6 h-6" />, title: 'BYOK Integrations', desc: 'Bring your own API keys. Connect your email, calendar, and tools — your data stays yours.', bg: 'bg-emerald-50', color: 'text-emerald-600' },
              { icon: <BarChart3 className="w-6 h-6" />, title: 'Analytics & Reports', desc: 'Track time-to-hire, source quality, and pipeline bottlenecks with beautiful dashboards.', bg: 'bg-amber-50', color: 'text-amber-600' },
            ].map((feature, idx) => (
              <AnimatedSection key={idx} delay={idx * 100}>
                <div className="bg-white p-8 rounded-2xl h-full border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-default">
                  <div className={`w-12 h-12 rounded-xl ${feature.bg} ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-gray-50 border-y border-gray-100 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">How it works</h2>
            <p className="text-xl text-gray-600">Three simple steps to supercharge your hiring.</p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>

            {[
              { step: '01', title: 'Create your workspace', desc: 'Sign up, name your company, and invite your hiring team to get started in minutes.' },
              { step: '02', title: 'Post jobs & source', desc: 'Publish to your branded careers page and easily import candidates from various job boards.' },
              { step: '03', title: 'Hire with confidence', desc: 'Track every candidate, gather structured feedback, and make data-driven decisions.' },
            ].map((item, idx) => (
              <AnimatedSection key={idx} delay={idx * 200} className="relative z-10">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-3xl font-bold text-blue-600 mb-6 border border-blue-100 shadow-md shadow-blue-500/10">
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-4">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations — infinite marquee */}
      <section id="integrations" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">Works with the tools you already use</h2>
            <p className="text-xl text-gray-600">
              Bring your own accounts and keys. Nothing routes through a third party you don't control.
            </p>
          </AnimatedSection>
        </div>

        <AnimatedSection>
          <div className="marquee-track overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="flex gap-4 w-max animate-marquee py-2">
              {[...INTEGRATIONS, ...INTEGRATIONS].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-6 py-4 bg-white border border-gray-200 rounded-xl shadow-sm shrink-0"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    {item.icon}
                  </div>
                  <span className="font-medium text-gray-700 whitespace-nowrap">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-gray-50 border-y border-gray-100 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">Recruiting teams that switched, and stayed</h2>
            <p className="text-xl text-gray-600">A few words from people who used to run hiring out of a spreadsheet.</p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <AnimatedSection key={i} delay={i * 150}>
                <div className="bg-white p-8 rounded-2xl h-full border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
                  <Quote className="w-8 h-8 text-blue-200 mb-4" />
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(5)].map((_, s) => (
                      <Star key={s} size={16} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 leading-relaxed flex-1 mb-6">"{t.quote}"</p>
                  <div className="flex items-center gap-3 pt-6 border-t border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold shrink-0">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                      <div className="text-gray-500 text-xs">{t.role}, {t.company}</div>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">Simple, transparent pricing</h2>
            <p className="text-xl text-gray-600">
              Start for free, upgrade when you need more power.
            </p>
          </AnimatedSection>

          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <AnimatedSection delay={0}>
              <div className="bg-white p-8 rounded-3xl h-full flex flex-col border border-gray-200 shadow-sm">
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">Starter</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">₹0</span>
                  <span className="text-gray-500"> / Free Trial</span>
                </div>
                <p className="text-gray-600 mb-8 pb-8 border-b border-gray-100">
                  Perfect for small teams just getting started with structured hiring.
                </p>
                <ul className="space-y-4 mb-8 flex-1">
                  {['Up to 5 users', '10 active jobs', '500 candidates', 'Email integration', 'Basic analytics', '14-day free trial'].map((feat, i) => (
                    <li key={i} className="flex items-center text-gray-700">
                      <CheckCircle2 className="w-5 h-5 text-blue-500 mr-3 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="w-full block text-center px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-gray-800">
                  Start Free Trial
                </Link>
              </div>
            </AnimatedSection>

            {/* Professional Plan */}
            <AnimatedSection delay={150}>
              <div className="bg-white p-8 rounded-3xl h-full flex flex-col relative border-2 border-blue-500 transform md:-translate-y-4 shadow-xl shadow-blue-500/15">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest text-white">
                  Most Popular
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">Professional</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">₹2,999</span>
                  <span className="text-gray-500"> / mo</span>
                </div>
                <p className="text-gray-600 mb-8 pb-8 border-b border-gray-100">
                  For growing companies that need unlimited power and advanced tools.
                </p>
                <ul className="space-y-4 mb-8 flex-1">
                  {['Up to 25 users', 'Unlimited jobs', '5,000 candidates', 'All integrations', 'Advanced analytics', 'Priority support', 'Custom pipeline stages'].map((feat, i) => (
                    <li key={i} className="flex items-center text-gray-800">
                      <CheckCircle2 className="w-5 h-5 text-blue-500 mr-3 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="w-full block text-center px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all font-medium shadow-md shadow-blue-500/25">
                  Get Started
                </Link>
              </div>
            </AnimatedSection>

            {/* Enterprise Plan */}
            <AnimatedSection delay={300}>
              <div className="bg-white p-8 rounded-3xl h-full flex flex-col border border-gray-200 shadow-sm">
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">Enterprise</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">Custom</span>
                </div>
                <p className="text-gray-600 mb-8 pb-8 border-b border-gray-100">
                  Tailored solutions for large organizations with complex needs.
                </p>
                <ul className="space-y-4 mb-8 flex-1">
                  {['Unlimited everything', 'SSO / SAML', 'Dedicated support', 'Custom SLAs', 'API access', 'White-label option'].map((feat, i) => (
                    <li key={i} className="flex items-center text-gray-700">
                      <CheckCircle2 className="w-5 h-5 text-blue-500 mr-3 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <button className="w-full px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-gray-800">
                  Contact Sales
                </button>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-24 bg-gray-50 relative z-10 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <AnimatedSection>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">Enterprise-grade security for your hiring data</h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                We treat your candidate and company data with the highest level of security. From tenant isolation to granular access controls, your data is protected.
              </p>

              <div className="space-y-6">
                {[
                  { icon: <Lock className="w-6 h-6 text-emerald-600" />, bg: 'bg-emerald-50', title: 'End-to-end encryption', desc: 'Data is encrypted at rest and in transit.' },
                  { icon: <Server className="w-6 h-6 text-blue-600" />, bg: 'bg-blue-50', title: 'Tenant isolation', desc: 'Strict separation of data between organizations.' },
                  { icon: <Shield className="w-6 h-6 text-violet-600" />, bg: 'bg-violet-50', title: 'Role-based access', desc: 'Granular controls for owners, admins, and interviewers.' },
                  { icon: <Check className="w-6 h-6 text-indigo-600" />, bg: 'bg-indigo-50', title: 'Your data, your control (BYOK)', desc: 'Bring your own API keys for integrations.' },
                ].map((item, i) => (
                  <div key={i} className="flex">
                    <div className={`mt-1 mr-4 ${item.bg} p-3 rounded-lg shrink-0`}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-gray-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedSection>

            <AnimatedSection delay={200} className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-200/40 to-blue-200/40 rounded-full blur-[100px]"></div>
              <div className="relative bg-white rounded-2xl p-8 border border-gray-200 shadow-xl">
                <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100">
                  <Shield className="w-8 h-8 text-emerald-600" />
                  <span className="text-xl font-semibold text-gray-900">Security Status: <span className="text-emerald-600">Secure</span></span>
                </div>
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Encryption at Rest</span>
                    <span className="text-emerald-600 font-semibold">AES-256 Active</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">SOC 2 Compliance</span>
                    <span className="text-amber-600 font-semibold">In Progress</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">GDPR Framework</span>
                    <span className="text-emerald-600 font-semibold">Ready</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Audit Logging</span>
                    <span className="text-emerald-600 font-semibold">Enabled</span>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 relative z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">Frequently asked questions</h2>
            <p className="text-xl text-gray-600">Everything you need to know about the product and billing.</p>
          </AnimatedSection>

          <div className="space-y-4">
            {[
              { q: 'What is an ATS?', a: 'An Applicant Tracking System (ATS) is software that manages your recruiting and hiring process, including job postings, candidate applications, interview scheduling, and team collaboration.' },
              { q: 'Is there a free trial?', a: 'Yes, we offer a 14-day free trial on our Starter plan. No credit card is required to sign up.' },
              { q: 'Can I import existing candidates?', a: 'Absolutely. You can import candidates via Excel/CSV files, and our AI parsing will automatically extract their details into structured profiles.' },
              { q: 'What integrations do you support?', a: "We currently support SMTP/Zoho for email and Google/Outlook for calendar syncs. Our 'Bring Your Own Key' architecture means your integrations use your own accounts securely." },
              { q: 'How is my data secured?', a: 'Data is encrypted at rest and in transit. We use strict tenant isolation (every model is keyed to your Organization ID) and Role-Based Access Control to ensure only authorized users access sensitive info.' },
              { q: 'Can I customize the hiring pipeline?', a: 'Yes! On the Professional and Enterprise plans, you can fully configure custom pipeline stages for each specific job role to match your exact hiring workflow.' },
            ].map((faq, i) => (
              <AnimatedSection key={i} delay={i * 100}>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => toggleFaq(i)}
                    className="w-full px-6 py-4 flex justify-between items-center text-left focus:outline-none"
                  >
                    <span className="font-medium text-lg text-gray-900">{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${activeFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  <div
                    className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${activeFaq === i ? 'max-h-48 pb-4 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className="text-gray-600">{faq.a}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-center shadow-2xl shadow-blue-500/25">
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Ready to transform your hiring?</h2>
                <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
                  Join hundreds of forward-thinking companies building their dream teams with SkillNix.
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
                  <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-blue-50 text-blue-700 rounded-full font-semibold text-lg transition-all shadow-lg">
                    Start Free Trial
                  </Link>
                  <a href="#demo" className="text-blue-100 hover:text-white font-medium flex items-center transition-colors">
                    Or book a personalized demo <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer — dark bookend for contrast */}
      <footer className="border-t border-gray-800 bg-gray-950 text-gray-300 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center space-x-2 mb-6">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-1.5 rounded-md">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">SkillNix</span>
              </div>
              <p className="text-gray-400 mb-6 max-w-sm">
                The modern applicant tracking system designed for ambitious teams. Hire smarter, scale faster.
              </p>
              <div className="flex space-x-4">
                {[1, 2, 3, 4].map(i => (
                  <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                    <div className="w-4 h-4 bg-current rounded-sm"></div>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#security" className="hover:text-white transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Data Processing</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} SkillNix Inc. All rights reserved.</p>
            <div className="flex items-center space-x-2 mt-4 md:mt-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
