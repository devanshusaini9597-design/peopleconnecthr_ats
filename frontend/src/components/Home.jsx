import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, Users, FileText, Plug, BarChart3, 
  Menu, X, ChevronDown, Lock, Shield, Server, ArrowRight, Zap, Check,
  Briefcase, CheckCircle2
} from 'lucide-react';

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
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
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

const Home = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans overflow-x-hidden">
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .glass-panel {
          background: rgba(23, 23, 23, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                SkillNix
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors">How it Works</a>
              <a href="#pricing" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors">Pricing</a>
              <a href="#security" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors">Security</a>
              <a href="#faq" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors">FAQ</a>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Link to="/login" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors px-4 py-2">
                Login
              </Link>
              <Link to="/register" className="text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full transition-all shadow-[0_0_15px_rgba(79,70,229,0.5)]">
                Start Free Trial
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-neutral-300 hover:text-white focus:outline-none"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden glass-panel border-t border-white/10 absolute top-20 left-0 w-full">
            <div className="px-4 pt-2 pb-6 space-y-2">
              <a href="#features" className="block px-3 py-2 text-base font-medium text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="block px-3 py-2 text-base font-medium text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
              <a href="#pricing" className="block px-3 py-2 text-base font-medium text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#security" className="block px-3 py-2 text-base font-medium text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Security</a>
              <a href="#faq" className="block px-3 py-2 text-base font-medium text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <Link to="/login" className="block w-full text-center px-4 py-2 border border-white/20 rounded-lg text-neutral-300 hover:bg-white/5">Login</Link>
                <Link to="/register" className="block w-full text-center px-4 py-2 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700">Start Free Trial</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/30 rounded-full mix-blend-screen filter blur-[100px] opacity-70 animate-blob"></div>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-600/30 rounded-full mix-blend-screen filter blur-[100px] opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-600/30 rounded-full mix-blend-screen filter blur-[100px] opacity-70 animate-blob animation-delay-4000"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <div className="inline-flex items-center px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-8">
              <Zap className="w-4 h-4 mr-2" />
              <span>SkillNix 2.0 is now live</span>
            </div>
          </AnimatedSection>
          
          <AnimatedSection delay={100}>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              Hire Smarter.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Scale Faster.</span>
            </h1>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <p className="mt-4 text-xl text-neutral-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              The modern ATS that grows with your team. Track candidates, schedule interviews, and close hires — all in one beautifully designed workspace.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={300}>
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full font-medium text-lg transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)] transform hover:-translate-y-1 flex items-center justify-center">
                Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <a href="#demo" className="w-full sm:w-auto px-8 py-4 glass-panel hover:bg-white/10 text-white rounded-full font-medium text-lg transition-all flex items-center justify-center">
                Book a Demo
              </a>
            </div>
            <p className="mt-6 text-sm text-neutral-500 font-medium">
              No credit card required · Free 14-day trial · Cancel anytime
            </p>
          </AnimatedSection>

          {/* Abstract Dashboard Mockup */}
          <AnimatedSection delay={500} className="mt-20">
            <div className="relative mx-auto max-w-5xl">
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent z-10 bottom-0 h-32 mt-auto"></div>
              <div className="glass-panel p-2 rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
                <div className="bg-[#0f0f11] rounded-xl overflow-hidden border border-white/5">
                  <div className="h-8 border-b border-white/5 flex items-center px-4 space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="p-6 grid grid-cols-4 gap-6 opacity-80">
                    <div className="col-span-1 border-r border-white/5 pr-6 space-y-4 hidden md:block">
                      <div className="h-8 w-full bg-white/5 rounded-md"></div>
                      <div className="h-8 w-3/4 bg-white/5 rounded-md"></div>
                      <div className="h-8 w-5/6 bg-white/5 rounded-md"></div>
                    </div>
                    <div className="col-span-4 md:col-span-3 space-y-6">
                      <div className="flex justify-between items-center">
                        <div className="h-10 w-48 bg-white/10 rounded-lg"></div>
                        <div className="h-10 w-32 bg-indigo-500/20 rounded-lg"></div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {[1,2,3].map(i => (
                          <div key={i} className="h-32 bg-white/5 rounded-xl border border-white/5 p-4 flex flex-col justify-between">
                            <div className="h-4 w-1/2 bg-white/10 rounded"></div>
                            <div className="h-8 w-full bg-white/5 rounded"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Trusted By / Stats */}
      <section className="py-12 border-y border-white/5 bg-neutral-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <p className="text-center text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-8">
              Trusted by 500+ innovative companies
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-white mb-1">50K+</div>
                <div className="text-sm text-neutral-500">Candidates Tracked</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">10K+</div>
                <div className="text-sm text-neutral-500">Hires Made</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">99.9%</div>
                <div className="text-sm text-neutral-500">Uptime</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">24/7</div>
                <div className="text-sm text-neutral-500">Support</div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Everything you need to build your dream team</h2>
            <p className="text-xl text-neutral-400">
              A complete toolkit designed to streamline your hiring process from sourcing to offering.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <LayoutDashboard className="w-6 h-6 text-indigo-400" />,
                title: "Visual Pipeline",
                desc: "Drag-and-drop kanban boards for every job. See where every candidate stands at a glance."
              },
              {
                icon: <Calendar className="w-6 h-6 text-violet-400" />,
                title: "Smart Scheduling",
                desc: "One-click interview scheduling with calendar sync. No more back-and-forth emails."
              },
              {
                icon: <Users className="w-6 h-6 text-blue-400" />,
                title: "Team Collaboration",
                desc: "Share feedback, assign tasks, and collaborate with your hiring team in real-time."
              },
              {
                icon: <FileText className="w-6 h-6 text-pink-400" />,
                title: "Resume Parsing",
                desc: "AI-powered resume parsing extracts skills, experience, and contact info automatically."
              },
              {
                icon: <Plug className="w-6 h-6 text-emerald-400" />,
                title: "BYOK Integrations",
                desc: "Bring your own API keys. Connect your email, calendar, and tools — your data stays yours."
              },
              {
                icon: <BarChart3 className="w-6 h-6 text-amber-400" />,
                title: "Analytics & Reports",
                desc: "Track time-to-hire, source quality, and pipeline bottlenecks with beautiful dashboards."
              }
            ].map((feature, idx) => (
              <AnimatedSection key={idx} delay={idx * 100}>
                <div className="glass-panel p-8 rounded-2xl h-full hover:bg-white/[0.03] transition-colors group cursor-default">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:border-indigo-500/50 transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                  <p className="text-neutral-400 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-neutral-900/20 border-y border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">How it works</h2>
            <p className="text-xl text-neutral-400">Three simple steps to supercharge your hiring.</p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            {[
              {
                step: "01",
                title: "Create your workspace",
                desc: "Sign up, name your company, and invite your hiring team to get started in minutes."
              },
              {
                step: "02",
                title: "Post jobs & source",
                desc: "Publish to your branded careers page and easily import candidates from various job boards."
              },
              {
                step: "03",
                title: "Hire with confidence",
                desc: "Track every candidate, gather structured feedback, and make data-driven decisions."
              }
            ].map((item, idx) => (
              <AnimatedSection key={idx} delay={idx * 200} className="relative z-10">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full glass-panel flex items-center justify-center text-3xl font-bold text-indigo-400 mb-6 border border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.2)]">
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-4">{item.title}</h3>
                  <p className="text-neutral-400 leading-relaxed">
                    {item.desc}
                  </p>
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
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Simple, transparent pricing</h2>
            <p className="text-xl text-neutral-400">
              Start for free, upgrade when you need more power.
            </p>
          </AnimatedSection>

          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <AnimatedSection delay={0}>
              <div className="glass-panel p-8 rounded-3xl h-full flex flex-col">
                <h3 className="text-2xl font-semibold text-white mb-2">Starter</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">₹0</span>
                  <span className="text-neutral-400"> / Free Trial</span>
                </div>
                <p className="text-neutral-400 mb-8 pb-8 border-b border-white/10">
                  Perfect for small teams just getting started with structured hiring.
                </p>
                <ul className="space-y-4 mb-8 flex-1">
                  {["Up to 5 users", "10 active jobs", "500 candidates", "Email integration", "Basic analytics", "14-day free trial"].map((feat, i) => (
                    <li key={i} className="flex items-center text-neutral-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-400 mr-3 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="w-full block text-center px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition-colors font-medium">
                  Start Free Trial
                </Link>
              </div>
            </AnimatedSection>

            {/* Professional Plan */}
            <AnimatedSection delay={150}>
              <div className="glass-panel p-8 rounded-3xl h-full flex flex-col relative border-indigo-500/50 transform md:-translate-y-4 shadow-[0_0_40px_rgba(79,70,229,0.15)] bg-indigo-950/20">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest text-white">
                  Most Popular
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Professional</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">₹2,999</span>
                  <span className="text-neutral-400"> / mo</span>
                </div>
                <p className="text-neutral-400 mb-8 pb-8 border-b border-white/10">
                  For growing companies that need unlimited power and advanced tools.
                </p>
                <ul className="space-y-4 mb-8 flex-1">
                  {["Up to 25 users", "Unlimited jobs", "5,000 candidates", "All integrations", "Advanced analytics", "Priority support", "Custom pipeline stages"].map((feat, i) => (
                    <li key={i} className="flex items-center text-neutral-100">
                      <CheckCircle2 className="w-5 h-5 text-indigo-400 mr-3 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="w-full block text-center px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors font-medium">
                  Get Started
                </Link>
              </div>
            </AnimatedSection>

            {/* Enterprise Plan */}
            <AnimatedSection delay={300}>
              <div className="glass-panel p-8 rounded-3xl h-full flex flex-col">
                <h3 className="text-2xl font-semibold text-white mb-2">Enterprise</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">Custom</span>
                </div>
                <p className="text-neutral-400 mb-8 pb-8 border-b border-white/10">
                  Tailored solutions for large organizations with complex needs.
                </p>
                <ul className="space-y-4 mb-8 flex-1">
                  {["Unlimited everything", "SSO / SAML", "Dedicated support", "Custom SLAs", "API access", "White-label option"].map((feat, i) => (
                    <li key={i} className="flex items-center text-neutral-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-400 mr-3 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <button className="w-full px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition-colors font-medium">
                  Contact Sales
                </button>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-24 bg-neutral-900/40 relative z-10 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <AnimatedSection>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Enterprise-grade security for your hiring data</h2>
              <p className="text-xl text-neutral-400 mb-8 leading-relaxed">
                We treat your candidate and company data with the highest level of security. From tenant isolation to granular access controls, your data is protected.
              </p>
              
              <div className="space-y-6">
                {[
                  { icon: <Lock className="w-6 h-6 text-emerald-400"/>, title: "End-to-end encryption", desc: "Data is encrypted at rest and in transit." },
                  { icon: <Server className="w-6 h-6 text-blue-400"/>, title: "Tenant isolation", desc: "Strict separation of data between organizations." },
                  { icon: <Shield className="w-6 h-6 text-violet-400"/>, title: "Role-based access", desc: "Granular controls for owners, admins, and interviewers." },
                  { icon: <Check className="w-6 h-6 text-indigo-400"/>, title: "Your data, your control (BYOK)", desc: "Bring your own API keys for integrations." }
                ].map((item, i) => (
                  <div key={i} className="flex">
                    <div className="mt-1 mr-4 bg-white/5 p-3 rounded-lg border border-white/10 shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-1">{item.title}</h4>
                      <p className="text-neutral-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={200} className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-indigo-500/20 rounded-full blur-[100px]"></div>
              <div className="relative glass-panel rounded-2xl p-8 border border-white/10 shadow-2xl">
                <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-white/10">
                  <Shield className="w-8 h-8 text-emerald-400" />
                  <span className="text-xl font-semibold">Security Status: <span className="text-emerald-400">Secure</span></span>
                </div>
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between items-center p-3 bg-black/40 rounded-lg">
                    <span className="text-neutral-400">Encryption at Rest</span>
                    <span className="text-emerald-400">AES-256 Active</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-black/40 rounded-lg">
                    <span className="text-neutral-400">SOC 2 Compliance</span>
                    <span className="text-amber-400">In Progress</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-black/40 rounded-lg">
                    <span className="text-neutral-400">GDPR Framework</span>
                    <span className="text-emerald-400">Ready</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-black/40 rounded-lg">
                    <span className="text-neutral-400">Audit Logging</span>
                    <span className="text-emerald-400">Enabled</span>
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
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Frequently asked questions</h2>
            <p className="text-xl text-neutral-400">Everything you need to know about the product and billing.</p>
          </AnimatedSection>

          <div className="space-y-4">
            {[
              {
                q: "What is an ATS?",
                a: "An Applicant Tracking System (ATS) is software that manages your recruiting and hiring process, including job postings, candidate applications, interview scheduling, and team collaboration."
              },
              {
                q: "Is there a free trial?",
                a: "Yes, we offer a 14-day free trial on our Starter plan. No credit card is required to sign up."
              },
              {
                q: "Can I import existing candidates?",
                a: "Absolutely. You can import candidates via Excel/CSV files, and our AI parsing will automatically extract their details into structured profiles."
              },
              {
                q: "What integrations do you support?",
                a: "We currently support SMTP/Zoho for email and Google/Outlook for calendar syncs. Our 'Bring Your Own Key' architecture means your integrations use your own accounts securely."
              },
              {
                q: "How is my data secured?",
                a: "Data is encrypted at rest and in transit. We use strict tenant isolation (every model is keyed to your Organization ID) and Role-Based Access Control to ensure only authorized users access sensitive info."
              },
              {
                q: "Can I customize the hiring pipeline?",
                a: "Yes! On the Professional and Enterprise plans, you can fully configure custom pipeline stages for each specific job role to match your exact hiring workflow."
              }
            ].map((faq, i) => (
              <AnimatedSection key={i} delay={i * 100}>
                <div className="glass-panel rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq(i)}
                    className="w-full px-6 py-4 flex justify-between items-center text-left focus:outline-none"
                  >
                    <span className="font-medium text-lg">{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform duration-300 ${activeFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  <div 
                    className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${activeFaq === i ? 'max-h-48 pb-4 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className="text-neutral-400">{faq.a}</p>
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
            <div className="relative rounded-3xl overflow-hidden glass-panel border border-indigo-500/30 p-12 text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-violet-600/20 z-0"></div>
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to transform your hiring?</h2>
                <p className="text-xl text-neutral-300 mb-10 max-w-2xl mx-auto">
                  Join hundreds of forward-thinking companies building their dream teams with SkillNix.
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
                  <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium text-lg transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                    Start Free Trial
                  </Link>
                  <a href="#demo" className="text-neutral-300 hover:text-white font-medium flex items-center transition-colors">
                    Or book a personalized demo <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center space-x-2 mb-6">
                <div className="bg-indigo-600 p-1.5 rounded-md">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">SkillNix</span>
              </div>
              <p className="text-neutral-400 mb-6 max-w-sm">
                The modern applicant tracking system designed for ambitious teams. Hire smarter, scale faster.
              </p>
              <div className="flex space-x-4">
                {/* Social placeholders */}
                {[1,2,3,4].map(i => (
                  <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 hover:bg-white/10 hover:text-white transition-colors">
                    <div className="w-4 h-4 bg-current rounded-sm"></div>
                  </a>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#security" className="hover:text-white transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Data Processing</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-sm text-neutral-500">
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