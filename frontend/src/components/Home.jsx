import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  motion, AnimatePresence, useScroll, useTransform,
  useMotionValue, useSpring, useMotionTemplate, useReducedMotion,
} from 'motion/react';
import {
  LayoutDashboard, Calendar, Users, FileText, Plug, BarChart3,
  Menu, X, ChevronDown, Lock, Shield, ShieldCheck, Server, ArrowRight, Zap, Check,
  Briefcase, CheckCircle2, Mail, MessageSquare, Webhook, FileSignature,
  Star, Quote, TrendingUp, Clock, Sparkles, Building2, Award, Rocket, Send,
} from 'lucide-react';

/* ============================================================
   Reusable motion primitives
   ============================================================ */

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

/** Scroll-triggered reveal wrapper. Pass `stagger` to orchestrate motion.div children. */
const Reveal = ({ children, className = '', stagger = false, amount = 0.2, ...rest }) => (
  <motion.div
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, amount }}
    variants={stagger ? staggerContainer : fadeUp}
    className={className}
    {...rest}
  >
    {children}
  </motion.div>
);

/** Cursor-follow spotlight glow, revealed on hover — tinted to the brand teal. */
const SpotlightCard = ({ children, className = '' }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const background = useMotionTemplate`radial-gradient(420px circle at ${mouseX}px ${mouseY}px, rgba(13,148,136,0.14), transparent 75%)`;

  return (
    <motion.div
      variants={fadeUp}
      onMouseMove={handleMouseMove}
      className={`group relative ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
};

/** Subtle 3D tilt that follows the cursor, with spring smoothing. */
const TiltCard = ({ children, className = '' }) => {
  const prefersReduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springCfg = { stiffness: 150, damping: 20, mass: 0.6 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], ['7deg', '-7deg']), springCfg);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], ['-7deg', '7deg']), springCfg);

  const handleMouseMove = (e) => {
    if (prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={prefersReduced ? undefined : { rotateX, rotateY, transformPerspective: 1200 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/** Wraps a button/link and gently pulls it toward the cursor. */
const Magnetic = ({ children, strength = 0.3, className = '' }) => {
  const prefersReduced = useReducedMotion();
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 16, mass: 0.2 });
  const springY = useSpring(y, { stiffness: 200, damping: 16, mass: 0.2 });

  const handleMouseMove = (e) => {
    if (prefersReduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={prefersReduced ? undefined : { x: springX, y: springY }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
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

const CountUpStat = ({ end, suffix = '', decimals = 0, duration = 1500, label, icon, color }) => {
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
    <motion.div ref={ref} variants={fadeUp} className="flex flex-col items-center text-center">
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-4xl font-bold text-stone-900 mb-1 tabular-nums">
        {value.toFixed(decimals)}{suffix}
      </div>
      <div className="text-sm text-stone-500 font-medium">{label}</div>
    </motion.div>
  );
};

/** Dependency-free animated mini area chart — draws itself in on scroll. */
const MiniAreaChart = ({ data, width = 300, height = 130, color = '#0d9488' }) => {
  const padding = 8;
  const values = data.map((d) => d.v);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (data.length - 1);
  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = padding + (1 - (d.v - min) / range) * (height - padding * 2);
    return [x, y];
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0]},${height - padding} L${points[0][0]},${height - padding} Z`;
  const gradId = 'miniAreaGrad';
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${gradId})`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.3 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r="4.5"
        fill={color}
        stroke="white"
        strokeWidth="2"
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1, type: 'spring', stiffness: 320, damping: 14 }}
      />
    </svg>
  );
};

/* ============================================================
   Data
   ============================================================ */

const LOGO_CLOUD = [
  'Northwind Robotics', 'BlueOrbit Labs', 'Cascade Analytics',
  'Vertex Dynamics', 'Lumen Health', 'Ridgeline Foods',
];

const USE_CASES = [
  {
    icon: Rocket, title: 'Startups & Scale-ups',
    desc: 'Get a real hiring pipeline running before you make your first recruiter hire.',
    stat: 'Live in an afternoon',
  },
  {
    icon: Users, title: 'Growing Teams',
    desc: 'Structured scorecards and calendar sync keep hiring consistent as headcount grows.',
    stat: 'Up to 5 seats on Starter',
  },
  {
    icon: Building2, title: 'Staffing & Recruiting Agencies',
    desc: 'Manage multiple clients with branded careers pages and a pipeline built for volume.',
    stat: 'Talent pools on Professional',
  },
  {
    icon: ShieldCheck, title: 'Enterprise & Multi-brand Orgs',
    desc: 'SSO, custom roles, and white-labeling for hiring across brands, teams, and regions.',
    stat: 'Dedicated success support',
  },
];

const GUARANTEES = [
  { icon: CheckCircle2, title: '30-day money-back guarantee', desc: 'Not the right fit? Get a full refund, no questions asked.' },
  { icon: Server, title: '99.9% uptime SLA', desc: "Enterprise plans come with an uptime commitment in writing." },
  { icon: Lock, title: 'Cancel anytime, no lock-in', desc: 'Month-to-month or annual — you stay because you want to.' },
];

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#product-tour', label: 'Product Tour' },
  { href: '#integrations', label: 'Integrations' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

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

const FEATURES = [
  {
    icon: <LayoutDashboard className="w-6 h-6" />, title: 'Visual Pipeline',
    desc: 'Drag-and-drop kanban boards for every job. See exactly where each candidate stands, color-coded by stage, so nothing slips through.',
    big: true,
  },
  {
    icon: <Calendar className="w-6 h-6" />, title: 'Smart Scheduling',
    desc: 'One-click interview scheduling with Google / Outlook calendar sync. No more back-and-forth emails.',
  },
  {
    icon: <Award className="w-6 h-6" />, title: 'Structured Scorecards',
    desc: 'Every interviewer scores against the same rubric, so debriefs are decisions — not debates.',
  },
  {
    icon: <FileText className="w-6 h-6" />, title: 'AI Resume Parsing',
    desc: 'Skills, experience, and contact info extracted automatically the moment a resume lands.',
  },
  {
    icon: <Plug className="w-6 h-6" />, title: 'BYOK Integrations',
    desc: 'Bring your own email, calendar, and signing keys. Your data never routes through a third party.',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />, title: 'Analytics & Reports',
    desc: 'Time-to-hire, source quality, and pipeline bottlenecks in real dashboards.',
  },
];

const STEPS = [
  { step: '01', title: 'Create your workspace', desc: 'Sign up, name your company, and invite your hiring team to get started in minutes.' },
  { step: '02', title: 'Post jobs & source', desc: 'Publish to your branded careers page and easily import candidates from various job boards.' },
  { step: '03', title: 'Hire with confidence', desc: 'Track every candidate, gather structured feedback, and make data-driven decisions.' },
];

const COMPARISON = {
  before: [
    'Candidate status lives in five different inboxes',
    'Interview feedback shows up as a one-line Slack message, if at all',
    'Scheduling is a 6-email round trip with a recruiter in the middle',
    'Nobody can say why a req has been open for 60 days',
  ],
  after: [
    'One pipeline, one source of truth, every stage color-coded',
    'Structured scorecards turn feedback into a comparable decision',
    'Calendar-synced scheduling links close interviews in one click',
    'Live analytics show exactly where every req is stuck, and why',
  ],
};

const TOUR_TABS = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: LayoutDashboard,
    heading: 'A pipeline your whole team actually looks at',
    bullets: [
      'Drag candidates between stages, or automate moves with rules',
      'Color-coded by stage for an instant read on pipeline health',
      'Custom stages per job on Professional & Enterprise',
    ],
  },
  {
    id: 'scheduling',
    label: 'Scheduling',
    icon: Calendar,
    heading: 'Interviews that book themselves',
    bullets: [
      'One-click scheduling synced to Google or Outlook calendars',
      'Interviewer availability resolved automatically, no back-and-forth',
      'Automated reminders cut candidate no-shows',
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    heading: 'See the funnel, not just the spreadsheet',
    bullets: [
      'Time-to-hire, source quality, and stage conversion at a glance',
      'Export board-ready reports in a click',
      'Scheduled reports land in your inbox automatically',
    ],
  },
];

const CHART_DATA = [
  { m: 'Feb', v: 32 }, { m: 'Mar', v: 41 }, { m: 'Apr', v: 38 },
  { m: 'May', v: 52 }, { m: 'Jun', v: 61 }, { m: 'Jul', v: 74 },
];

const PLANS = [
  {
    id: 'starter', icon: Briefcase, name: 'Starter',
    tagline: 'For lean teams getting organized.',
    monthly: 0, annual: 0,
    features: ['Core ATS workspace', 'Jobs, candidates & pipeline', 'Basic analytics', 'MFA / 2FA', 'Duplicate candidate detection', 'Candidate surveys & localized portal'],
    cta: 'Start Free Trial', to: '/register', mail: false, highlight: false,
  },
  {
    id: 'professional', icon: Zap, name: 'Professional',
    tagline: 'For growing teams that need depth and automation.',
    monthly: 79, annual: 63,
    features: ['Everything in Starter', 'Talent pools & assessments', 'Calendar (Google/Outlook) + BYO email', 'LLM resume scoring (BYOK AI keys)', 'Video conferencing BYOK & self-schedule', 'Semantic search, JD generator & AI drafting'],
    cta: 'Get Started', to: '/register', mail: false, highlight: true,
  },
  {
    id: 'enterprise', icon: Building2, name: 'Enterprise',
    tagline: 'For agencies & multi-brand hiring orgs.',
    monthly: null, annual: null,
    features: ['Everything in Professional', 'SSO (SAML/OIDC) + SCIM', 'Storage/KMS/CRM/HRIS/SIEM BYOK', 'IP allowlist, retention & legal hold', 'Approvals, offer templates & white-label CMS', 'Dedicated / VPC deployment option'],
    cta: 'Talk to Sales', to: 'mailto:sales@skillnix.app', mail: true, highlight: false,
  },
];

const FAQS = [
  { q: 'What is an ATS?', a: 'An Applicant Tracking System (ATS) is software that manages your recruiting and hiring process, including job postings, candidate applications, interview scheduling, and team collaboration.' },
  { q: 'Is there a free trial?', a: 'Yes, we offer a 14-day free trial on our Starter plan. No credit card is required to sign up.' },
  { q: 'Can I import existing candidates?', a: 'Absolutely. You can import candidates via Excel/CSV files. Resume parsing extracts structured fields with regex/OCR — it is not an LLM. Resume scoring against a job description is the separate LLM feature (Professional+, BYOK AI keys).' },
  { q: 'What integrations do you support?', a: "Bring Your Own Key (BYOK) for email (SMTP/SES/SendGrid/Mailgun/Postmark), calendar (Google/Outlook), AI providers, SMS/WhatsApp, e-sign, background checks, job boards, video, storage, CRM, HRIS, SIEM, and data warehouses — using your own accounts and keys." },
  { q: 'How is my data secured?', a: 'Data is encrypted at rest and in transit. We support MFA, SSO (SAML/OIDC), SCIM, IP allowlisting, session policies, and optional customer-managed KMS. Tenant isolation and RBAC apply on every plan. See our Trust Center for subprocessors and DPA templates.' },
  { q: 'Can I customize the hiring pipeline?', a: 'Yes! On the Professional and Enterprise plans, you can fully configure custom pipeline stages for each specific job role to match your exact hiring workflow.' },
  { q: 'Do you support skills assessments?', a: 'Yes — Professional and Enterprise plans include a built-in assessment engine, so you can send timed skills tests as a stage in your pipeline and review scored results automatically.' },
];

/* ============================================================
   Page
   ============================================================ */

const Home = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [billing, setBilling] = useState('monthly');
  const [demoForm, setDemoForm] = useState({ name: '', email: '', company: '', teamSize: '1-10', message: '' });
  const [demoSent, setDemoSent] = useState(false);

  const updateDemoForm = (field) => (e) => setDemoForm((f) => ({ ...f, [field]: e.target.value }));

  const handleDemoSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Demo request — ${demoForm.company || demoForm.name}`);
    const body = encodeURIComponent(
      `Name: ${demoForm.name}\nWork email: ${demoForm.email}\nCompany: ${demoForm.company}\nTeam size: ${demoForm.teamSize}\n\nMessage:\n${demoForm.message || '(none)'}`
    );
    setDemoSent(true);
    window.location.href = `mailto:sales@skillnix.app?subject=${subject}&body=${body}`;
  };

  const { scrollYProgress } = useScroll();
  const prefersReduced = useReducedMotion();

  const heroX = useMotionValue(0);
  const heroY = useMotionValue(0);
  const heroXInverse = useTransform(heroX, (v) => -v);
  const heroYInverse = useTransform(heroY, (v) => -v);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleHeroMouseMove = (e) => {
    if (prefersReduced) return;
    const { innerWidth, innerHeight } = window;
    heroX.set((e.clientX / innerWidth - 0.5) * 50);
    heroY.set((e.clientY / innerHeight - 0.5) * 50);
  };

  const toggleFaq = (index) => setActiveFaq(activeFaq === index ? null : index);
  const activeTourTab = TOUR_TABS.find((t) => t.id === activeTab) || TOUR_TABS[0];

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans overflow-x-hidden">
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

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 26s linear infinite; }
        .marquee-track:hover .animate-marquee { animation-play-state: paused; }

        @keyframes shine {
          0% { transform: translateX(-150%) skewX(-20deg); }
          100% { transform: translateX(250%) skewX(-20deg); }
        }
        .shine-sweep { position: relative; overflow: hidden; }
        .shine-sweep::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 25%; height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: shine 5s ease-in-out infinite;
          animation-delay: 1.5s;
          pointer-events: none;
        }

        @keyframes rotate-border {
          100% { transform: rotate(360deg); }
        }
        .gradient-border-wrap {
          position: relative;
          border-radius: 1.5rem;
          padding: 2px;
          overflow: hidden;
        }
        .gradient-border-wrap::before {
          content: '';
          position: absolute;
          inset: -60%;
          background: conic-gradient(from 0deg, transparent 0%, #0d9488 25%, #7c3aed 50%, transparent 65%);
          animation: rotate-border 5s linear infinite;
        }

        @keyframes aurora {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-aurora {
          background-size: 200% 200%;
          animation: aurora 8s ease-in-out infinite;
        }

        @keyframes floaty {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-floaty { animation: floaty 5s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .animate-blob, .animate-marquee, .shine-sweep::before,
          .gradient-border-wrap::before, .animate-aurora, .animate-floaty { animation: none; }
        }
      `}</style>

      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-600 to-violet-600 origin-left z-[60]"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Ambient page-wide grain texture */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.025] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-stone-200' : 'bg-white/40 backdrop-blur-sm border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center space-x-2.5">
              <motion.div
                whileHover={{ rotate: -8, scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-brand-500/20 ring-1 ring-stone-900/5 flex-shrink-0"
              >
                <img src="/atslogo.jpg" alt="SkillNix" className="w-full h-full object-cover" />
              </motion.div>
              <span className="text-xl font-bold text-stone-900">SkillNix</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => setHoveredLink(link.href)}
                  onMouseLeave={() => setHoveredLink(null)}
                  className="relative text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors px-4 py-2 rounded-full"
                >
                  {hoveredLink === link.href && (
                    <motion.span
                      layoutId="nav-hover-pill"
                      className="absolute inset-0 bg-stone-100 rounded-full -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center space-x-2">
              <Link to="/login" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors px-4 py-2">
                Login
              </Link>
              <Magnetic strength={0.2}>
                <Link to="/register" className="btn-cta-primary rounded-full px-5 py-2.5">
                  Start Free Trial
                </Link>
              </Magnetic>
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-stone-600 hover:text-stone-900 focus:outline-none" aria-label="Toggle menu">
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden bg-white border-t border-stone-100 w-full shadow-lg overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-2">
                {NAV_LINKS.map((link) => (
                  <a key={link.href} href={link.href} className="block px-3 py-2 text-base font-medium text-stone-600 hover:text-stone-900" onClick={() => setMobileMenuOpen(false)}>
                    {link.label}
                  </a>
                ))}
                <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
                  <Link to="/login" className="block w-full text-center px-4 py-2 border border-stone-200 rounded-lg text-stone-700 hover:bg-stone-50">Login</Link>
                  <Link to="/register" className="btn-cta-primary block w-full text-center rounded-lg">Start Free Trial</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero */}
      <section
        onMouseMove={handleHeroMouseMove}
        className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-[90vh] flex items-center"
      >
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 animate-blob">
            <motion.div style={prefersReduced ? undefined : { x: heroX, y: heroY }} className="w-full h-full bg-brand-200/50 rounded-full filter blur-[120px] opacity-70" />
          </div>
          <div className="absolute top-0 right-1/4 w-96 h-96 animate-blob animation-delay-2000">
            <motion.div style={prefersReduced ? undefined : { x: heroXInverse, y: heroYInverse }} className="w-full h-full bg-violet-200/50 rounded-full filter blur-[120px] opacity-70" />
          </div>
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-emerald-200/40 rounded-full filter blur-[120px] opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="show" variants={staggerContainer}>
            <motion.div variants={fadeUp} className="inline-flex items-center px-3 py-1 rounded-full border border-brand-200 bg-brand-50 text-brand-700 text-sm font-medium mb-8">
              <Zap className="w-4 h-4 mr-2" />
              <span>SkillNix 2.0 — AI resume parsing is live</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-stone-900">
              Hire Smarter.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-teal-600 to-violet-600 bg-[length:200%_auto] animate-aurora">
                Scale Faster.
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-4 text-xl text-stone-600 max-w-3xl mx-auto mb-10 leading-relaxed">
              The modern ATS that grows with your team. Track candidates, schedule interviews, and close hires — all in one beautifully designed workspace.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Magnetic strength={0.25}>
                <Link
                  to="/register"
                  className="btn-cta-primary w-full sm:w-auto px-8 py-4 rounded-full text-lg inline-flex"
                >
                  Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Magnetic>
              <Magnetic strength={0.25}>
                <a href="#product-tour" className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50 text-stone-800 rounded-full font-semibold text-lg transition-all shadow-sm flex items-center justify-center">
                  See it in Action
                </a>
              </Magnetic>
            </motion.div>

            <motion.p variants={fadeUp} className="mt-6 text-sm text-stone-500 font-medium">
              No credit card required · Free 14-day trial · Cancel anytime
            </motion.p>
          </motion.div>

          {/* Dashboard preview mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-20 relative"
          >
            <TiltCard className="relative mx-auto max-w-5xl">
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 bottom-0 h-32 mt-auto pointer-events-none"></div>
              <div className="shine-sweep bg-white p-2 rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-left">
                <div className="rounded-xl overflow-hidden border border-stone-100 flex">
                  {/* Dark stone sidebar with teal accents — matches the real app shell */}
                  <div className="hidden md:flex flex-col w-40 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950 p-4 space-y-3 shrink-0 relative">
                    <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-teal-500/40 via-transparent to-transparent" />
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-teal-700 flex items-center justify-center">
                        <LayoutDashboard className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="h-2.5 w-14 bg-white/30 rounded"></div>
                    </div>
                    <div className="h-3 w-full bg-brand-500/30 rounded mt-3"></div>
                    <div className="h-3 w-3/4 bg-white/10 rounded"></div>
                    <div className="h-3 w-5/6 bg-white/10 rounded"></div>
                    <div className="h-3 w-2/3 bg-white/10 rounded"></div>
                  </div>
                  <div className="flex-1 bg-stone-50 p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-40 bg-stone-200 rounded"></div>
                      <div className="h-8 w-24 bg-gradient-to-r from-brand-600 to-teal-700 rounded-lg"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { c: 'bg-sky-50', b: 'bg-sky-500' },
                        { c: 'bg-emerald-50', b: 'bg-emerald-500' },
                        { c: 'bg-violet-50', b: 'bg-violet-500' },
                      ].map((s, i) => (
                        <div key={i} className={`h-24 ${s.c} rounded-xl border border-stone-100 p-3 flex flex-col justify-between`}>
                          <div className="h-2.5 w-1/2 bg-white/70 rounded"></div>
                          <div className={`h-2.5 w-8 rounded ${s.b}`}></div>
                        </div>
                      ))}
                    </div>
                    {/* Mini kanban strip reflecting real pipeline stage colors */}
                    <div className="grid grid-cols-5 gap-2 pt-2">
                      {[
                        { name: 'Applied', dot: 'bg-sky-500' },
                        { name: 'Screening', dot: 'bg-amber-500' },
                        { name: 'Interview', dot: 'bg-brand-500' },
                        { name: 'Offer', dot: 'bg-violet-500' },
                        { name: 'Hired', dot: 'bg-emerald-500' },
                      ].map((col, i) => (
                        <div key={i} className="bg-white rounded-lg border border-stone-200 shadow-sm p-2 space-y-1.5">
                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`}></span>
                            <div className="h-1.5 w-10 bg-stone-200 rounded"></div>
                          </div>
                          <div className="h-6 bg-stone-50 rounded border border-stone-100"></div>
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
              className="hidden lg:flex items-center gap-2 absolute -left-6 top-16 bg-white rounded-xl shadow-xl border border-stone-200 px-4 py-3 animate-floaty"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-stone-900 leading-tight">Time-to-hire ↓ 38%</div>
                <div className="text-[11px] text-stone-500">vs. spreadsheet hiring</div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.3 }}
              className="hidden lg:flex items-center gap-2 absolute -right-4 bottom-24 bg-white rounded-xl shadow-xl border border-stone-200 px-4 py-3 animate-floaty animation-delay-2000"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-stone-900 leading-tight">12 offers this week</div>
                <div className="text-[11px] text-stone-500">across 4 open reqs</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Logo Cloud */}
      <section className="py-14 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-center text-xs font-semibold text-stone-400 uppercase tracking-widest mb-8">
              Trusted by hiring teams at
            </p>
          </Reveal>
          <Reveal stagger className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
            {LOGO_CLOUD.map((name, i) => (
              <motion.span
                key={i}
                variants={fadeUp}
                whileHover={{ scale: 1.06 }}
                className="text-lg sm:text-xl font-bold tracking-tight text-stone-300 hover:text-brand-600 transition-colors duration-300 cursor-default select-none"
              >
                {name}
              </motion.span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-stone-100 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-center text-sm font-semibold text-stone-500 uppercase tracking-wider mb-10">
              The numbers behind the switch
            </p>
          </Reveal>
          <Reveal stagger className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <CountUpStat end={50} suffix="K+" label="Candidates Tracked" icon={<Users size={20} className="text-brand-600" />} color="bg-brand-50" />
            <CountUpStat end={10} suffix="K+" label="Hires Made" icon={<TrendingUp size={20} className="text-emerald-600" />} color="bg-emerald-50" />
            <CountUpStat end={99.9} suffix="%" decimals={1} label="Uptime" icon={<Server size={20} className="text-violet-600" />} color="bg-violet-50" />
            <motion.div variants={fadeUp} className="flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                <Clock size={20} className="text-amber-600" />
              </div>
              <div className="text-4xl font-bold text-stone-900 mb-1">24/7</div>
              <div className="text-sm text-stone-500 font-medium">Support</div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* Why teams switch */}
      <section className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 text-brand-700 text-sm font-semibold mb-3">
              <Sparkles className="w-4 h-4" /> Why teams switch
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900">From scattered inboxes to one real pipeline</h2>
          </Reveal>

          <Reveal stagger className="grid md:grid-cols-2 gap-6">
            <motion.div variants={fadeUp} className="rounded-2xl border border-stone-200 bg-stone-50 p-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-5">Before, with spreadsheets</h3>
              <ul className="space-y-4">
                {COMPARISON.before.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-stone-600">
                    <X className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} className="rounded-2xl border border-brand-200 bg-brand-50/50 p-8 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-300/20 rounded-full blur-3xl" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-700 mb-5 relative">With SkillNix</h3>
              <ul className="space-y-4 relative">
                {COMPARISON.after.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-stone-800 font-medium">
                    <CheckCircle2 className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* Built for every team */}
      <section className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900">Built for every kind of hiring team</h2>
            <p className="text-xl text-stone-600 mt-4">
              Whether you're hiring your first ten people or scaling recruiting across five brands.
            </p>
          </Reveal>

          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {USE_CASES.map((uc, i) => {
              const Icon = uc.icon;
              return (
                <SpotlightCard key={i} className="bg-white p-7 rounded-2xl border border-stone-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full">
                  <div className="flex flex-col h-full">
                    <div className="icon-box-ats mb-5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 mb-2">{uc.title}</h3>
                    <p className="text-stone-600 text-sm leading-relaxed flex-1">{uc.desc}</p>
                    <div className="mt-5 pt-4 border-t border-stone-100 text-xs font-semibold text-brand-700 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {uc.stat}
                    </div>
                  </div>
                </SpotlightCard>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* Features — bento grid */}
      <section id="features" className="py-24 relative z-10 bg-stone-50 border-y border-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-stone-900">Everything you need to build your dream team</h2>
            <p className="text-xl text-stone-600">
              A complete toolkit designed to streamline your hiring process from sourcing to offering.
            </p>
          </Reveal>

          <Reveal
            stagger
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:grid-flow-row-dense gap-6 lg:auto-rows-[190px]"
          >
            {FEATURES.map((feature, idx) => (
              <SpotlightCard
                key={idx}
                className={`bg-white p-8 rounded-2xl border border-stone-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${
                  feature.big ? 'lg:col-span-2 lg:row-span-2' : ''
                }`}
              >
                <div className={`h-full flex flex-col ${feature.big ? 'justify-between' : ''}`}>
                  <div>
                    <motion.div
                      whileHover={{ rotate: 8, scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                      className="icon-box-ats mb-6"
                    >
                      {feature.icon}
                    </motion.div>
                    <h3 className={`font-semibold text-stone-900 mb-3 ${feature.big ? 'text-2xl' : 'text-xl'}`}>{feature.title}</h3>
                    <p className="text-stone-600 leading-relaxed">{feature.desc}</p>
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

      {/* Product Tour */}
      <section id="product-tour" className="py-24 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-stone-900">Take a two-minute tour</h2>
            <p className="text-xl text-stone-600">The three screens your hiring team will live in every day.</p>
          </Reveal>

          <Reveal className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-1 p-1.5 rounded-full bg-stone-100 border border-stone-200">
              {TOUR_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
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
                    <Icon className="w-4 h-4 relative" />
                    <span className="relative">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-2 gap-10 items-center bg-white rounded-3xl border border-stone-200 shadow-xl p-6 sm:p-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <h3 className="text-2xl font-bold text-stone-900 mb-5">{activeTourTab.heading}</h3>
                <ul className="space-y-4">
                  {activeTourTab.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 text-stone-600">
                      <CheckCircle2 className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Magnetic strength={0.2} className="mt-8 block">
                  <Link to="/register" className="btn-cta-primary rounded-xl px-6 py-3 inline-flex">
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
                className="rounded-2xl bg-stone-50 border border-stone-200 p-5 min-h-[280px] flex items-center"
              >
                {activeTab === 'pipeline' && (
                  <div className="grid grid-cols-3 gap-3 w-full">
                    {[
                      { name: 'Screening', dot: 'bg-amber-500', n: 3 },
                      { name: 'Interview', dot: 'bg-brand-500', n: 4 },
                      { name: 'Offer', dot: 'bg-violet-500', n: 2 },
                    ].map((col, i) => (
                      <div key={i} className="bg-white rounded-xl border border-stone-200 shadow-sm p-2.5 space-y-2">
                        <div className="flex items-center gap-1.5 px-1">
                          <span className={`w-2 h-2 rounded-full ${col.dot}`}></span>
                          <span className="text-xs font-bold text-stone-600">{col.name}</span>
                          <span className="ml-auto text-[10px] text-stone-400 font-semibold">{col.n}</span>
                        </div>
                        {Array.from({ length: col.n }).map((_, j) => (
                          <div key={j} className="rounded-lg border border-stone-100 bg-stone-50 p-2 space-y-1">
                            <div className="h-2 w-3/4 bg-stone-200 rounded"></div>
                            <div className="h-1.5 w-1/2 bg-stone-100 rounded"></div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'scheduling' && (
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-xs font-bold text-stone-600">This week</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Synced
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
                        <div key={i} className="text-center">
                          <div className="text-[10px] font-semibold text-stone-400 mb-1.5">{d}</div>
                          <div className="rounded-lg bg-white border border-stone-200 h-24 p-1 space-y-1">
                            {i === 1 && <div className="h-5 rounded bg-brand-100 border border-brand-200"></div>}
                            {i === 2 && <div className="h-5 rounded bg-violet-100 border border-violet-200"></div>}
                            {i === 2 && <div className="h-5 rounded bg-sky-100 border border-sky-200"></div>}
                            {i === 4 && <div className="h-5 rounded bg-emerald-100 border border-emerald-200"></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'analytics' && (
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-bold text-stone-600">Applications, last 6 months</span>
                      <span className="text-xs font-bold text-emerald-600">+131%</span>
                    </div>
                    <div className="h-40 w-full">
                      <MiniAreaChart data={CHART_DATA} color="#0d9488" />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-stone-50 border-y border-stone-100 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-stone-900">How it works</h2>
            <p className="text-xl text-stone-600">Three simple steps to supercharge your hiring.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-stone-200 overflow-hidden">
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
                className="h-full w-full bg-gradient-to-r from-brand-500 to-violet-500 origin-left"
              />
            </div>

            {STEPS.map((item, idx) => (
              <Reveal key={idx} className="relative z-10" transition={{ duration: 0.7, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}>
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    whileHover={{ scale: 1.08, boxShadow: '0 12px 24px -8px rgba(13,148,136,0.35)' }}
                    className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-3xl font-bold text-brand-600 mb-6 border border-brand-100 shadow-md shadow-brand-500/10"
                  >
                    {item.step}
                  </motion.div>
                  <h3 className="text-2xl font-semibold text-stone-900 mb-4">{item.title}</h3>
                  <p className="text-stone-600 leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-stone-900">Works with the tools you already use</h2>
            <p className="text-xl text-stone-600">
              Bring your own accounts and keys. Nothing routes through a third party you don't control.
            </p>
          </Reveal>
        </div>

        <Reveal>
          <div className="marquee-track overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="flex gap-4 w-max animate-marquee py-2">
              {[...INTEGRATIONS, ...INTEGRATIONS].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05, borderColor: 'rgb(153 246 228)' }}
                  className="flex items-center gap-3 px-6 py-4 bg-white border border-stone-200 rounded-xl shadow-sm shrink-0"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                    {item.icon}
                  </div>
                  <span className="font-medium text-stone-700 whitespace-nowrap">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-stone-50 border-y border-stone-100 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-stone-900">Recruiting teams that switched, and stayed</h2>
            <p className="text-xl text-stone-600">A few words from people who used to run hiring out of a spreadsheet.</p>
          </Reveal>

          <Reveal stagger className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <SpotlightCard key={i} className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
                <Quote className="w-8 h-8 text-brand-200 mb-4" />
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} size={16} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-stone-700 leading-relaxed flex-1 mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-6 border-t border-stone-100">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-600 to-teal-700 flex items-center justify-center text-white font-semibold shrink-0"
                  >
                    {t.name.charAt(0)}
                  </motion.div>
                  <div>
                    <div className="font-semibold text-stone-900 text-sm">{t.name}</div>
                    <div className="text-stone-500 text-xs">{t.role}, {t.company}</div>
                  </div>
                </div>
              </SpotlightCard>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Guarantee band */}
      <section className="py-14 bg-brand-50/60 border-y border-brand-100 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal stagger className="grid sm:grid-cols-3 gap-8">
            {GUARANTEES.map((g, i) => {
              const Icon = g.icon;
              return (
                <motion.div key={i} variants={fadeUp} className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-brand-100">
                    <Icon className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-stone-900 mb-1">{g.title}</h4>
                    <p className="text-sm text-stone-600">{g.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-stone-900">Simple, transparent pricing</h2>
            <p className="text-xl text-stone-600">Start for free, upgrade when you need more power.</p>
          </Reveal>

          <Reveal className="flex justify-center mb-16">
            <div className="inline-flex items-center gap-1 p-1.5 rounded-full bg-stone-100 border border-stone-200">
              {['monthly', 'annual'].map((cycle) => {
                const active = billing === cycle;
                return (
                  <button
                    key={cycle}
                    onClick={() => setBilling(cycle)}
                    className={`relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                      active ? 'text-white' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="billing-pill"
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-600 to-teal-700 shadow-md shadow-brand-500/25"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="relative capitalize">{cycle}</span>
                    {cycle === 'annual' && (
                      <span className={`relative text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                        Save 20%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Reveal>

          <Reveal stagger className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
            {PLANS.map((plan) => {
              const PlanIcon = plan.icon;
              const price = billing === 'annual' ? plan.annual : plan.monthly;
              const CardInner = (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${plan.highlight ? 'bg-gradient-to-br from-brand-500 to-teal-700' : 'bg-stone-100'}`}>
                      <PlanIcon className={`w-5 h-5 ${plan.highlight ? 'text-white' : 'text-stone-600'}`} />
                    </div>
                    <h3 className="text-2xl font-semibold text-stone-900">{plan.name}</h3>
                  </div>
                  <div className="mb-4">
                    {price === null ? (
                      <span className="text-4xl font-bold text-stone-900">Custom</span>
                    ) : price === 0 ? (
                      <>
                        <span className="text-4xl font-bold text-stone-900">$0</span>
                        <span className="text-stone-500"> / Free Trial</span>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-stone-900">${price}</span>
                        <span className="text-stone-500"> / mo{billing === 'annual' ? ', billed annually' : ''}</span>
                      </>
                    )}
                  </div>
                  <p className="text-stone-600 mb-8 pb-8 border-b border-stone-100">{plan.tagline}</p>
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-center text-stone-700">
                        <CheckCircle2 className="w-5 h-5 text-brand-500 mr-3 shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  {plan.mail ? (
                    <a href={plan.to} className="w-full block text-center px-6 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors font-medium text-stone-800">
                      {plan.cta}
                    </a>
                  ) : plan.highlight ? (
                    <Magnetic strength={0.15} className="w-full">
                      <Link to={plan.to} className="btn-cta-primary w-full block text-center rounded-xl">
                        {plan.cta}
                      </Link>
                    </Magnetic>
                  ) : (
                    <Link to={plan.to} className="w-full block text-center px-6 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors font-medium text-stone-800">
                      {plan.cta}
                    </Link>
                  )}
                </>
              );

              if (plan.highlight) {
                return (
                  <div key={plan.id} className="relative lg:-translate-y-4 hover:-translate-y-6 transition-transform duration-300 ease-out">
                    <motion.div variants={fadeUp}>
                      <div className="gradient-border-wrap shadow-xl shadow-brand-500/15">
                        <div className="relative bg-white rounded-[1.4rem] p-8 flex flex-col h-full">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-gradient-to-r from-brand-600 to-teal-700 rounded-full text-xs font-bold uppercase tracking-widest text-white z-10">
                            Most Popular
                          </div>
                          {CardInner}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              }

              return (
                <motion.div key={plan.id} variants={fadeUp} whileHover={{ y: -6 }} className="bg-white p-8 rounded-3xl h-full flex flex-col border border-stone-200 shadow-sm transition-shadow hover:shadow-lg">
                  {CardInner}
                </motion.div>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-24 bg-stone-50 relative z-10 border-y border-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-stone-900">Enterprise-grade security for your hiring data</h2>
              <p className="text-xl text-stone-600 mb-8 leading-relaxed">
                We treat your candidate and company data with the highest level of security. From tenant isolation to granular access controls, your data is protected.
              </p>

              <div className="space-y-6">
                {[
                  { icon: <Lock className="w-6 h-6 text-emerald-600" />, bg: 'bg-emerald-50', title: 'End-to-end encryption', desc: 'Data is encrypted at rest and in transit.' },
                  { icon: <Server className="w-6 h-6 text-brand-600" />, bg: 'bg-brand-50', title: 'Tenant isolation', desc: 'Strict separation of data between organizations.' },
                  { icon: <Shield className="w-6 h-6 text-violet-600" />, bg: 'bg-violet-50', title: 'Role-based access', desc: 'Granular controls for owners, admins, and interviewers.' },
                  { icon: <Check className="w-6 h-6 text-teal-700" />, bg: 'bg-teal-50', title: 'Your data, your control (BYOK)', desc: 'Bring your own API keys for integrations.' },
                ].map((item, i) => (
                  <motion.div key={i} whileHover={{ x: 4 }} className="flex">
                    <div className={`mt-1 mr-4 ${item.bg} p-3 rounded-lg shrink-0`}>{item.icon}</div>
                    <div>
                      <h4 className="text-lg font-semibold text-stone-900 mb-1">{item.title}</h4>
                      <p className="text-stone-600">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Reveal>

            <Reveal className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-200/40 to-brand-200/40 rounded-full blur-[100px]"></div>
              <div className="relative bg-white rounded-2xl p-8 border border-stone-200 shadow-xl">
                <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-stone-100">
                  <ShieldCheck className="w-8 h-8 text-emerald-600" />
                  <span className="text-xl font-semibold text-stone-900">
                    Security Status:{' '}
                    <span className="text-emerald-600 inline-flex items-center gap-1.5">
                      Secure
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-2 h-2 rounded-full bg-emerald-500"
                      />
                    </span>
                  </span>
                </div>
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                    <span className="text-stone-500">Encryption at Rest</span>
                    <span className="text-emerald-600 font-semibold">AES-256 Active</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                    <span className="text-stone-500">SOC 2 Compliance</span>
                    <span className="text-amber-600 font-semibold">In Progress</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                    <span className="text-stone-500">GDPR Framework</span>
                    <span className="text-emerald-600 font-semibold">Ready</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                    <span className="text-stone-500">Audit Logging</span>
                    <span className="text-emerald-600 font-semibold">Enabled</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Book a Demo */}
      <section id="demo" className="py-24 bg-stone-50 border-y border-stone-100 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div className="inline-flex items-center gap-1.5 text-brand-700 text-sm font-semibold mb-3">
                <Sparkles className="w-4 h-4" /> Talk to us
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-5">Want a walkthrough instead?</h2>
              <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                Tell us a bit about your team and we'll set up a live demo tailored to your hiring workflow — no generic slide deck.
              </p>
              <ul className="space-y-4">
                {[
                  '30-minute call, tailored to your hiring stages',
                  'See white-labeling & SSO if you\'re evaluating for Enterprise',
                  'No pressure — cancel or reschedule anytime',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-stone-700">
                    <CheckCircle2 className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal>
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xl p-8">
                {demoSent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-10"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 mb-2">Your email client should be open</h3>
                    <p className="text-stone-600 text-sm mb-6">
                      Finish sending from there and our team will get back to you within one business day.
                    </p>
                    <button onClick={() => setDemoSent(false)} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
                      ← Back to the form
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleDemoSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1.5">Full name</label>
                        <input
                          type="text" required value={demoForm.name} onChange={updateDemoForm('name')}
                          placeholder="Jordan Lee"
                          className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1.5">Work email</label>
                        <input
                          type="email" required value={demoForm.email} onChange={updateDemoForm('email')}
                          placeholder="jordan@company.com"
                          className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-stone-900"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Company</label>
                      <input
                        type="text" required value={demoForm.company} onChange={updateDemoForm('company')}
                        placeholder="Acme Inc."
                        className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Team size</label>
                      <select
                        value={demoForm.teamSize} onChange={updateDemoForm('teamSize')}
                        className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-stone-900 bg-white"
                      >
                        <option>1-10</option>
                        <option>11-50</option>
                        <option>51-200</option>
                        <option>201-1000</option>
                        <option>1000+</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">What are you hoping to solve? <span className="text-stone-400 font-normal">(optional)</span></label>
                      <textarea
                        rows={3} value={demoForm.message} onChange={updateDemoForm('message')}
                        placeholder="We're outgrowing our spreadsheet-based process..."
                        className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-stone-900 resize-none"
                      />
                    </div>
                    <Magnetic strength={0.15} className="w-full block">
                      <button type="submit" className="btn-cta-primary w-full rounded-xl inline-flex items-center justify-center gap-2">
                        Request a Demo <Send className="w-4 h-4" />
                      </button>
                    </Magnetic>
                    <p className="text-xs text-stone-400 text-center">
                      We'll open your email client with this pre-filled, ready to send to our team.
                    </p>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 relative z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-stone-900">Frequently asked questions</h2>
            <p className="text-xl text-stone-600">Everything you need to know about the product and billing.</p>
          </Reveal>

          <Reveal stagger className="space-y-4">
            {FAQS.map((faq, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm hover:border-stone-300 transition-colors">
                <button onClick={() => toggleFaq(i)} className="w-full px-6 py-4 flex justify-between items-center text-left focus:outline-none">
                  <span className="font-medium text-lg text-stone-900">{faq.q}</span>
                  <motion.span animate={{ rotate: activeFaq === i ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
                    <ChevronDown className="w-5 h-5 text-stone-400" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {activeFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-4 text-stone-600">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-brand-600 via-teal-700 to-violet-700 bg-[length:200%_200%] animate-aurora p-12 text-center shadow-2xl shadow-brand-500/25">
              <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-16 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 text-brand-100 text-sm font-semibold mb-4">
                  <Sparkles className="w-4 h-4" /> Free for 14 days, no card required
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Ready to transform your hiring?</h2>
                <p className="text-xl text-brand-100 mb-10 max-w-2xl mx-auto">
                  Join hundreds of forward-thinking companies building their dream teams with SkillNix.
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
                  <Magnetic>
                    <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-brand-50 text-brand-700 rounded-full font-semibold text-lg transition-all shadow-lg inline-block">
                      Start Free Trial
                    </Link>
                  </Magnetic>
                  <a href="#demo" className="text-brand-100 hover:text-white font-medium flex items-center transition-colors">
                    Or book a demo <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-800 bg-stone-950 text-stone-300 pt-16 pb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center space-x-2.5 mb-6">
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                  <img src="/atslogo.jpg" alt="SkillNix" className="w-full h-full object-cover" />
                </div>
                <span className="text-xl font-bold text-white">SkillNix</span>
              </div>
              <p className="text-stone-400 mb-6 max-w-sm">
                The modern applicant tracking system designed for ambitious teams. Hire smarter, scale faster.
              </p>
              <p className="text-stone-500 text-sm">Built for recruiting teams that move fast.</p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-stone-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#product-tour" className="hover:text-white transition-colors">Product Tour</a></li>
                <li><a href="#integrations" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#security" className="hover:text-white transition-colors">Security</a></li>
                <li><Link to="/trust" className="hover:text-white transition-colors">Trust Center</Link></li>
                <li><Link to="/status" className="hover:text-white transition-colors">Status</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Get in touch</h4>
              <ul className="space-y-3 text-sm text-stone-400">
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                <li><a href="#demo" className="hover:text-white transition-colors">Book a Demo</a></li>
                <li><a href="mailto:sales@skillnix.app" className="hover:text-white transition-colors inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Talk to Sales</a></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Start Free Trial</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center text-sm text-stone-500">
            <p>&copy; {new Date().getFullYear()} SkillNix Inc. All rights reserved.</p>
            <div className="flex items-center space-x-2 mt-4 md:mt-0">
              <Link to="/status" className="flex items-center space-x-2 hover:text-stone-300 transition-colors">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>All systems operational</span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
