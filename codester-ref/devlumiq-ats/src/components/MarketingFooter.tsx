'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   MarketingFooter — Public website footer
   Sections: Hero CTA Banner · Newsletter Strip · Brand Column ·
             Link Columns (Product / Company / Resources / Legal) ·
             Bottom Bar (Status indicator · Social icons · Copyright)
   Used by: src/app/(marketing)/layout.tsx · src/app/careers/layout.tsx
───────────────────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Twitter, Linkedin, Github, Send, Check, Star, Users, Globe, Shield, ArrowUpRight, Play, Zap, TrendingUp, Award } from 'lucide-react';
import Logo from './Logo';
import { useLocale } from '@/components/providers/LocaleProvider';

interface FooterLink {
  href: string;
  key?: string;
  label?: string;
}

interface FooterSection {
  titleKey: string;
  links: FooterLink[];
}

const footerLinks: FooterSection[] = [
  { 
    titleKey: 'footer.product', 
    links: [
      { href: '/features', key: 'nav.features' },
      { href: '/careers', key: '', label: 'Careers' },
      { href: '/enterprise', key: 'footer.link.enterprise' },
      { href: '/ai-automation', key: 'footer.link.aiAuto' },
      { href: '/integrations', key: 'footer.link.integrations' },
      { href: '/pricing', key: 'nav.pricing' },
      { href: '/customers', key: 'footer.link.caseStudies' },
    ] 
  },
  { 
    titleKey: 'footer.resources', 
    links: [
      { href: '/resources', key: 'footer.link.blog' },
      { href: '/faq', key: 'nav.faq' },
      { href: '/security', key: 'footer.link.security' },
      { href: '/about', key: 'nav.about' },
    ] 
  },
  { 
    titleKey: 'footer.company', 
    links: [
      { href: '/contact', key: 'nav.contact' },
      { href: '/terms', key: 'nav.terms' },
      { href: '/privacy', key: 'nav.privacy' },
    ] 
  },
];

export default function MarketingFooter() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = () => {
    if (email.trim() && email.includes('@')) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="relative bg-gradient-to-b from-stone-900 to-stone-950 text-stone-300 overflow-visible pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-stone-800/50 before:absolute before:inset-x-0 before:top-0 before:h-px before:content-[''] before:bg-gradient-to-r before:from-transparent before:via-brand-500/40 before:to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">

        {/* Brand hero */}
        <div className="mb-14 sm:mb-18 text-center pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 mb-6">
            <Zap className="w-3 h-3 text-brand-400" />
            {t('footer.badge')}
          </div>
          <h2 className="text-3xl sm:text-[2.5rem] lg:text-5xl font-black text-white leading-[1.1] tracking-tight mb-4">
            {t('footer.headline')}<br className="hidden sm:block" />{' '}
            <span className="bg-gradient-to-r from-brand-400 via-teal-400 to-brand-300 bg-clip-text text-transparent">{t('footer.headlineAccent')}</span>
          </h2>
          <p className="text-stone-400 max-w-md mx-auto text-sm sm:text-[0.9375rem] leading-relaxed mb-7">
            {t('footer.heroDesc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 8px 32px rgba(13,148,136,0.35)' }}
                whileTap={{ scale: 0.97 }}
                className="group w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-brand-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/25 text-sm flex items-center justify-center gap-2"
              >
                {t('footer.startFree')}
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </motion.button>
            </Link>
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto px-7 py-3.5 bg-white/[0.05] border border-white/[0.08] text-stone-300 hover:text-white hover:border-white/20 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Play className="w-3.5 h-3.5" /> {t('footer.watchDemo')}
              </motion.button>
            </Link>
          </div>
        </div>

        {/* Trust stats strip */}
        <div className="mb-10 sm:mb-12 grid grid-cols-2 sm:grid-cols-4 gap-4 pb-10 sm:pb-12 border-b border-stone-800/60">
          {[
            { icon: Users, value: '15+', labelKey: 'footer.stat1.label', color: 'text-brand-400', bg: 'bg-brand-500/10' },
            { icon: Star, value: 'Next.js', labelKey: 'footer.stat2.label', color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { icon: TrendingUp, value: 'TS', labelKey: 'footer.stat3.label', color: 'text-teal-400', bg: 'bg-teal-500/10' },
            { icon: Shield, value: 'Prisma', labelKey: 'footer.stat4.label', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(({ icon: Icon, value, labelKey, color, bg }) => (
            <div key={labelKey} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className={`font-black text-lg leading-tight ${color}`}>{value}</p>
                <p className="text-[11px] text-stone-500 leading-tight">{t(labelKey)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Newsletter strip */}
        <div className="mb-12 sm:mb-16 relative overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-br from-stone-800/80 via-stone-800/60 to-teal-900/30 p-6 sm:p-8">
          {/* Glow */}
          <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse 70% 60% at 20% 50%, rgba(13,148,136,0.18), transparent 70%)' }} />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="text-emerald-400 text-[11px] font-bold uppercase tracking-widest">{t('footer.newsletter.badge')}</span>
              </div>
              <p className="font-bold text-white text-lg sm:text-xl leading-snug">{t('footer.newsletter.title')}</p>
              <p className="text-stone-400 text-sm mt-1.5">{t('footer.newsletter.desc')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto lg:flex-shrink-0">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                placeholder={t('footer.newsletter.placeholder')}
                className="w-full sm:w-56 min-w-0 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-stone-500 text-sm focus:border-brand-500 focus:bg-white/15 focus:outline-none transition-colors"
                aria-label="Email for newsletter"
              />
              <button
                onClick={handleSubscribe}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-500 active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {subscribed ? (
                  <><Check className="w-3.5 h-3.5" /> {t('footer.newsletter.subscribed')}</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> {t('footer.newsletter.subscribe')}</>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand col — spans 2 cols on md */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 group mb-4">
              <motion.div whileHover={{ scale: 1.05 }} className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Logo className="w-5 h-5 text-white" />
              </motion.div>
              <div className="flex items-baseline gap-0.5">
                <span className="font-black text-white">Devlumiq</span>
                <span className="font-bold text-brand-400 text-xs uppercase tracking-wider ml-0.5">ATS</span>
              </div>
            </Link>
            <p className="text-sm text-stone-400 leading-relaxed max-w-[220px]">
              {t('footer.tagline')}
            </p>
            <a href="mailto:support@devlumiq.com" className="mt-5 inline-flex items-center gap-2 text-stone-400 hover:text-brand-400 text-sm font-medium transition-colors group">
              <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center group-hover:bg-brand-500/10 transition-colors">
                <Mail className="w-3.5 h-3.5" />
              </div>
              support@devlumiq.com
            </a>
            {/* Award badge */}
            <div className="mt-5 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-white leading-tight">{t('footer.award.title')}</p>
                <p className="text-[10px] text-stone-500">{t('footer.award.sub')}</p>
              </div>
            </div>
          </div>
          {/* Link columns — each 1 col on md */}
          {footerLinks.map((section) => (
            <div key={section.titleKey}>
              <h4 className="font-black text-white text-[11px] uppercase tracking-widest mb-4">{t(section.titleKey)}</h4>
              <ul className="space-y-0">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="group flex items-center gap-1 text-sm text-stone-500 hover:text-stone-200 transition-colors py-2 min-h-[40px]"
                    >
                      <span className="w-0 overflow-hidden group-hover:w-3 transition-all duration-150 flex-shrink-0">
                        <ArrowUpRight className="w-3 h-3 text-brand-400" />
                      </span>
                      {link.label || (link.key ? t(link.key) : '')}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 sm:mt-14 pt-6 sm:pt-8 border-t border-stone-800/60">
          {/* Row 1: Status + Social */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[11px] font-semibold">{t('footer.systems')}</span>
            </div>
            <div className="flex items-center gap-2">
              {[
                { href: 'https://twitter.com/devlumiq', label: 'Twitter', Icon: Twitter },
                { href: 'https://www.linkedin.com/company/devlumiq', label: 'LinkedIn', Icon: Linkedin },
                { href: 'https://github.com/devlumiq', label: 'GitHub', Icon: Github },
              ].map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center text-stone-500 hover:text-white hover:bg-brand-600/30 hover:border-brand-500/30 transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          {/* Row 2: Copyright + Legal */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <p className="text-xs text-stone-600 order-2 sm:order-1">© {new Date().getFullYear()} Devlumiq ATS. {t('footer.copyright')}</p>
            <div className="flex items-center gap-4 sm:gap-6 order-1 sm:order-2">
              <Link href="/privacy" className="text-xs text-stone-500 hover:text-stone-300 transition-colors">{t('footer.link.privacy')}</Link>
              <span className="w-px h-3 bg-stone-800" />
              <Link href="/terms" className="text-xs text-stone-500 hover:text-stone-300 transition-colors">{t('footer.link.terms')}</Link>
              <span className="w-px h-3 bg-stone-800" />
              <Link href="/security" className="text-xs text-stone-500 hover:text-stone-300 transition-colors">{t('footer.link.security')}</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
