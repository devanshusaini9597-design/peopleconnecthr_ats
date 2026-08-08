'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   MarketingHeader — Public website navigation
   Sections: Logo · Desktop Nav (with mega-menu dropdowns) ·
             Auth Buttons · Mobile Hamburger Menu
   Used by: src/app/(marketing)/layout.tsx · src/app/careers/layout.tsx
───────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, ChevronRight, Building2, Zap,
  Plug, Shield, HelpCircle, Mail, ArrowUpRight,
  Sparkles, BarChart3, BookOpen, Target, Rocket,
} from 'lucide-react';
import Logo from './Logo';
import LocaleSwitcher from './LocaleSwitcher';
import { useLocale } from '@/components/providers/LocaleProvider';

export default function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { t } = useLocale();

  const mainNavLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/features', label: t('nav.features') },
    { href: '/careers', label: 'Careers' },
    { href: '/enterprise', label: t('nav.enterprise'), badge: t('nav.badge.new') },
    { href: '/pricing', label: t('nav.pricing') },
  ];

  const megaMenuSections = [
    {
      title: t('nav.mega.product'),
      items: [
        { href: '/ai-automation', label: t('nav.m.ai.label'), desc: t('nav.m.ai.desc'), icon: Zap, color: 'text-violet-500 bg-violet-50' },
        { href: '/integrations', label: t('nav.m.integrations.label'), desc: t('nav.m.integrations.desc'), icon: Plug, color: 'text-blue-500 bg-blue-50' },
        { href: '/features', label: t('nav.m.features.label'), desc: t('nav.m.features.desc'), icon: Sparkles, color: 'text-amber-500 bg-amber-50' },
      ]
    },
    {
      title: t('nav.mega.solutions'),
      items: [
        { href: '/enterprise', label: t('nav.m.enterprise.label'), desc: t('nav.m.enterprise.desc'), icon: Building2, color: 'text-emerald-500 bg-emerald-50' },
        { href: '/customers', label: t('nav.m.customers.label'), desc: t('nav.m.customers.desc'), icon: BarChart3, color: 'text-brand-500 bg-brand-50' },
        { href: '/security', label: t('nav.m.security.label'), desc: t('nav.m.security.desc'), icon: Shield, color: 'text-rose-500 bg-rose-50' },
      ]
    },
    {
      title: t('nav.mega.resources'),
      items: [
        { href: '/resources', label: t('nav.m.blog.label'), desc: t('nav.m.blog.desc'), icon: BookOpen, color: 'text-cyan-500 bg-cyan-50' },
        { href: '/faq', label: t('nav.m.help.label'), desc: t('nav.m.help.desc'), icon: HelpCircle, color: 'text-purple-500 bg-purple-50' },
        { href: '/contact', label: t('nav.m.contact.label'), desc: t('nav.m.contact.desc'), icon: Mail, color: 'text-pink-500 bg-pink-50' },
      ]
    }
  ];

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
    <header
      className={`sticky top-0 left-0 right-0 z-[100] w-full transition-all duration-300 ease-out ${
        scrolled
          ? 'bg-white/[0.96] backdrop-blur-2xl border-b border-stone-200/70 shadow-[0_2px_24px_-4px_rgba(0,0,0,0.08),0_1px_0_rgba(0,0,0,0.04)]'
          : 'bg-white/80 backdrop-blur-md border-b border-stone-100'
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-brand-500/70 via-60% to-teal-400/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[60px] sm:h-[68px]">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="relative">
              <motion.div
                whileHover={{ scale: 1.06, rotate: -3 }}
                whileTap={{ scale: 0.97 }}
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-teal-600 flex items-center justify-center shadow-[0_4px_14px_-2px_rgba(13,148,136,0.45)] group-hover:shadow-[0_6px_20px_-2px_rgba(13,148,136,0.55)] transition-all duration-300"
              >
                <Logo className="w-[18px] h-[18px] text-white" />
              </motion.div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-black text-[15px] sm:text-base tracking-tight text-stone-900">Devlumiq</span>
              <span className="font-bold text-brand-600 text-[11px] sm:text-xs tracking-wider uppercase ml-0.5">ATS</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {mainNavLinks.map((link) => {
              const isActive = pathname === link.href;
              const isPartial = pathname?.startsWith(link.href) && link.href !== '/';
              const active = isActive || isPartial;
              return (
                <Link key={link.href} href={link.href}>
                  <span className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer select-none ${
                    active ? 'text-brand-700' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
                  }`}>
                    {link.label}
                    {link.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-black bg-gradient-to-r from-brand-500 to-teal-500 text-white rounded-full uppercase tracking-wide">
                        {link.badge}
                      </span>
                    )}
                    {active && (
                      <motion.span layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-lg bg-brand-50 border border-brand-100 -z-10"
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
                    )}
                  </span>
                </Link>
              );
            })}

            {/* Mega Menu */}
            <div className="relative group/mega">
              <span className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer select-none ${
                megaMenuSections.some(s => s.items.some(i => pathname === i.href))
                  ? 'text-brand-700 bg-brand-50 border border-brand-100'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
              }`}>
                {t('nav.solutions')}
                <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover/mega:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </span>

              <div className="pointer-events-none group-hover/mega:pointer-events-auto absolute top-[calc(100%+2px)] left-1/2 -translate-x-1/2 w-[680px] opacity-0 group-hover/mega:opacity-100 translate-y-2 group-hover/mega:translate-y-0 transition-all duration-200 ease-out z-50">
                <div className="rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.14),0_0_0_1px_rgba(0,0,0,0.06)] overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-r from-brand-600 to-teal-600 flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-white/80" />
                    <p className="text-xs font-bold text-white/90 uppercase tracking-widest">{t('nav.mega.tagline')}</p>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-1">
                    {megaMenuSections.map((section) => (
                      <div key={section.title}>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-black text-stone-400 uppercase tracking-widest">{section.title}</p>
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const active = pathname === item.href;
                          return (
                            <Link key={item.href} href={item.href}>
                              <div className={`group/item flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer ${active ? 'bg-brand-50' : 'hover:bg-stone-50'}`}>
                                <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center flex-shrink-0 group-hover/item:scale-105 transition-transform duration-150`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className={`font-semibold text-sm ${active ? 'text-brand-700' : 'text-stone-900'}`}>{item.label}</p>
                                  <p className="text-[11px] text-stone-500 truncate">{item.desc}</p>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="mx-4 mb-4 p-3.5 rounded-xl bg-gradient-to-r from-stone-50 to-brand-50/40 border border-stone-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center">
                        <Target className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-stone-900">{t('nav.m.demo.title')}</p>
                        <p className="text-[11px] text-stone-500">{t('nav.m.demo.desc')}</p>
                      </div>
                    </div>
                    <Link href="/contact">
                      <span className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap">
                        {t('nav.m.demo.btn')}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Desktop Right */}
          <div className="hidden lg:flex items-center gap-3">
            <LocaleSwitcher />
            <div className="w-px h-5 bg-stone-200/80 mx-1" />
            <Link href="/login">
              <span className="flex items-center px-3.5 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 transition-colors duration-150 cursor-pointer">
                {t('nav.loginBtn')}
              </span>
            </Link>
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 6px 24px -4px rgba(13,148,136,0.4)' }}
                whileTap={{ scale: 0.97 }}
                className="group flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl font-bold text-sm shadow-[0_2px_12px_-2px_rgba(13,148,136,0.35)] transition-all duration-200"
              >
                <span>{t('nav.startFree')}</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-150" />
              </motion.button>
            </Link>
          </div>

          {/* Mobile Buttons */}
          <div className="lg:hidden flex items-center gap-2">
            <LocaleSwitcher />
            <Link href="/signup">
              <span className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold cursor-pointer">
                {t('nav.freeTrial')}
              </span>
            </Link>
            <motion.button
              onClick={() => setMobileOpen(!mobileOpen)}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {mobileOpen ? (
                  <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <X className="w-5 h-5 text-stone-700" />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Menu className="w-5 h-5 text-stone-700" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>
    </header>

    {/* Mobile Slide-over */}
    <AnimatePresence>
      {mobileOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-[105] lg:hidden"
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-[360px] bg-white shadow-2xl z-[110] lg:hidden overflow-y-auto"
          >
            {/* Mobile Header */}
            <div className="sticky top-0 bg-white/98 backdrop-blur-2xl border-b border-stone-100/80 px-4 py-3.5 flex items-center justify-between z-10">
              <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center">
                  <Logo className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-baseline">
                  <span className="font-extrabold text-stone-900">Devlumiq</span>
                  <span className="font-bold text-brand-600 ml-1 text-sm">ATS</span>
                </div>
              </Link>
              <motion.button onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.95 }} className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200">
                <X className="w-5 h-5 text-stone-700" />
              </motion.button>
            </div>

            {/* Mobile Content */}
            <div className="p-4 pb-8 space-y-2">
              <p className="px-1 pt-2 text-[10px] font-black text-stone-400 uppercase tracking-widest">{t('nav.mobile.nav')}</p>
              <div className="space-y-0.5">
                {mainNavLinks.map((link, i) => {
                  const isActive = pathname === link.href;
                  return (
                    <motion.div key={link.href} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 28 }}>
                      <Link href={link.href} onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between py-3 px-4 rounded-xl font-semibold text-sm transition-colors ${isActive ? 'bg-brand-50 text-brand-700 border border-brand-100' : 'text-stone-700 hover:bg-stone-50'}`}>
                        <span>{link.label}</span>
                        <div className="flex items-center gap-2">
                          {link.badge && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-gradient-to-r from-brand-500 to-teal-500 text-white rounded-full uppercase tracking-wide">{link.badge}</span>
                          )}
                          <ChevronRight className={`w-4 h-4 ${isActive ? 'text-brand-500' : 'text-stone-300'}`} />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <div className="space-y-1 pt-2">
                {megaMenuSections.map((section, sectionIdx) => (
                  <div key={section.title}>
                    <p className="px-1 pt-3 pb-1 text-[10px] font-black text-stone-400 uppercase tracking-widest">{section.title}</p>
                    <div className="space-y-0.5">
                      {section.items.map((item, i) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                          <motion.div key={item.href} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (sectionIdx * 3 + i) * 0.03 + 0.2 }}>
                            <Link href={item.href} onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${isActive ? 'bg-brand-50 border border-brand-100' : 'hover:bg-stone-50'}`}>
                              <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center flex-shrink-0`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm ${isActive ? 'text-brand-700' : 'text-stone-900'}`}>{item.label}</p>
                                <p className="text-xs text-stone-500 truncate">{item.desc}</p>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile CTAs */}
              <div className="mt-4 pt-5 border-t border-stone-100 space-y-2.5">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-stone-50 to-brand-50/40 border border-stone-200/80">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-stone-900">{t('nav.mobile.demo.title')}</p>
                    <p className="text-[11px] text-stone-500">{t('nav.mobile.demo.desc')}</p>
                  </div>
                  <Link href="/contact" onClick={() => setMobileOpen(false)}>
                    <span className="px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-bold text-brand-700 shadow-sm cursor-pointer whitespace-nowrap">{t('nav.mobile.demo.btn')}</span>
                  </Link>
                </div>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <motion.div whileTap={{ scale: 0.98 }}
                    className="w-full py-3 px-4 rounded-xl font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 flex items-center justify-center gap-1.5 text-sm transition-colors">
                    {t('nav.loginBtn')}
                  </motion.div>
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)}>
                  <motion.button whileTap={{ scale: 0.98 }}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-brand-600 to-teal-600 shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 text-sm">
                    {t('nav.startFree')} <ArrowUpRight className="w-4 h-4" />
                  </motion.button>
                </Link>
                <p className="text-center text-[11px] text-stone-400">{t('nav.noCredit')}</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
