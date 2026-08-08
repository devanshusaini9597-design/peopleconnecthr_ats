'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import {
  Shield, Lock, Server, Award, Fingerprint,
  Eye, Database, CheckCircle2, ArrowRight,
  ShieldCheck, Key, Cpu, Zap, Globe, AlertTriangle,
  Bug, Users, RefreshCw, Star, Layers, Activity, FileCheck
} from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const complianceCerts = [
  { name: 'GDPR',         descKey: 'gdpr',  icon: Globe,       color: 'from-blue-500 to-cyan-500',     statusKey: 'compliant' as const },
  { name: 'CCPA',         descKey: 'ccpa',  icon: Shield,      color: 'from-violet-500 to-purple-500', statusKey: 'compliant' as const },
  { name: 'RBAC',         descKey: 'rbac',  icon: Key,         color: 'from-emerald-500 to-teal-500',  statusKey: 'compliant' as const },
  { name: 'Audit Logs',   descKey: 'audit', icon: FileCheck,   color: 'from-amber-500 to-orange-500',  statusKey: 'compliant' as const },
  { name: 'TLS 1.3',      descKey: 'tls',   icon: ShieldCheck, color: 'from-rose-500 to-pink-500',     statusKey: 'compliant' as const },
  { name: 'Rate Limiting', descKey: 'rate', icon: Award,       color: 'from-brand-500 to-teal-500',    statusKey: 'compliant' as const },
];

const certDescriptions: Record<string, string> = {
  gdpr: 'EU data protection', ccpa: 'California privacy',
  rbac: 'Role-based access control', audit: 'Full activity audit trail',
  tls: 'Encrypted in transit', rate: 'API abuse prevention',
};

const featureData = [
  { key: 'f1', icon: ShieldCheck, color: 'from-emerald-500 to-teal-600'  },
  { key: 'f2', icon: Lock,        color: 'from-blue-500 to-cyan-600'     },
  { key: 'f3', icon: Server,      color: 'from-violet-500 to-purple-600' },
  { key: 'f4', icon: Fingerprint, color: 'from-amber-500 to-orange-600'  },
  { key: 'f5', icon: Eye,         color: 'from-rose-500 to-pink-600'     },
  { key: 'f6', icon: Database,    color: 'from-indigo-500 to-blue-600'   },
  { key: 'f7', icon: Activity,    color: 'from-brand-500 to-teal-600'    },
  { key: 'f8', icon: Bug,         color: 'from-red-500 to-rose-600'      },
  { key: 'f9', icon: Cpu,         color: 'from-cyan-500 to-blue-600'     },
];

const practiceData = [
  { key: 'p1', icon: AlertTriangle, color: 'text-emerald-400' },
  { key: 'p2', icon: Activity,      color: 'text-blue-400'    },
  { key: 'p3', icon: Users,         color: 'text-violet-400'  },
  { key: 'p4', icon: Cpu,           color: 'text-amber-400'   },
  { key: 'p5', icon: Star,          color: 'text-rose-400'    },
  { key: 'p6', icon: Globe,         color: 'text-cyan-400'    },
];

const layerKeys = ['layer1', 'layer2', 'layer3', 'layer4', 'layer5', 'layer6'] as const;

const stats = [
  { value: 'TLS 1.3', labelKey: 'security.hero.stat1Label' },
  { value: 'bcrypt',  labelKey: 'security.hero.stat2Label' },
  { value: 'RBAC',    labelKey: 'security.hero.stat3Label' },
  { value: '6+',      labelKey: 'security.hero.stat4Label' },
];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Floating Particle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function FloatingParticle({ delay, x, y }: { delay: number; x: string; y: string }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-emerald-400/40 pointer-events-none"
      style={{ left: x, top: y }}
      animate={{ y: [0, -28, 0], opacity: [0.3, 0.8, 0.3] }}
      transition={{ duration: 3 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Security Orb â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function SecurityOrb() {
  return (
    <div className="relative w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80 mx-auto select-none">
      {/* Outer orbit */}
      <motion.div
        className="absolute inset-0 rounded-full border border-emerald-500/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        {[0, 90, 180, 270].map((deg) => (
          <div
            key={deg}
            className="absolute w-3 h-3 rounded-full bg-emerald-500/60 shadow-lg shadow-emerald-500/50"
            style={{ top: '50%', left: '50%', transform: `rotate(${deg}deg) translateX(138px) translate(-50%,-50%)` }}
          />
        ))}
      </motion.div>
      {/* Middle orbit */}
      <motion.div
        className="absolute inset-8 rounded-full border border-teal-500/20"
        animate={{ rotate: -360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      >
        {[45, 135, 225, 315].map((deg) => (
          <div
            key={deg}
            className="absolute w-2 h-2 rounded-full bg-teal-400/60"
            style={{ top: '50%', left: '50%', transform: `rotate(${deg}deg) translateX(95px) translate(-50%,-50%)` }}
          />
        ))}
      </motion.div>
      {/* Inner orbit */}
      <motion.div
        className="absolute inset-16 rounded-full border border-emerald-400/15"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
      {/* Glow */}
      <div className="absolute inset-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 blur-xl" />
      {/* Center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
        </motion.div>
      </div>
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function SecurityPage() {
  const { t } = useLocale();
  const [activeLayer, setActiveLayer] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  const particles = Array.from({ length: 18 }, (_, i) => ({
    delay: i * 0.35,
    x: `${(i * 17 + 5) % 100}%`,
    y: `${(i * 23 + 8) % 100}%`,
  }));

  return (
    <>
      {/* â”€â”€â”€ HERO â”€â”€â”€ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-900 to-emerald-950" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(16,185,129,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.15) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Glows */}
        <div className="absolute top-1/4 left-1/6 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/6 w-96 h-96 bg-teal-500/8 rounded-full blur-3xl pointer-events-none" />
        {/* Particles */}
        {particles.map((p, i) => <FloatingParticle key={i} {...p} />)}

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 backdrop-blur-sm border border-emerald-500/30 mb-8"
              >
                <motion.div
                  className="w-2 h-2 rounded-full bg-emerald-400"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-300">{t('security.badge')}</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6"
              >
                {t('security.hero.title')}
                <span className="block bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {t('security.hero.titleHighlight')}
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-base sm:text-lg text-stone-400 mb-10 leading-relaxed max-w-xl"
              >
                {t('security.hero.desc')}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row gap-4 mb-12"
              >
                <Link href="/contact">
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: '0 0 28px rgba(16,185,129,0.38)' }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    {t('security.hero.cta')}
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </Link>
                <Link href="/contact">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-7 py-3.5 bg-white/8 text-white rounded-xl font-semibold text-sm border border-white/15 hover:bg-white/14 backdrop-blur-sm transition-all"
                  >
                    {t('security.hero.whitepaper')}
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </Link>
              </motion.div>

              {/* Stat row */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              >
                {stats.map((s, i) => (
                  <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <span className="text-xl sm:text-2xl font-extrabold text-emerald-400">{s.value}</span>
                    <span className="text-xs text-stone-500 mt-0.5 text-center leading-snug">{t(s.labelKey)}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Orb */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
              className="hidden lg:flex items-center justify-center"
            >
              <SecurityOrb />
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-stone-500"
        >
          <div className="w-6 h-10 rounded-full border-2 border-stone-600 flex items-start justify-center p-1.5">
            <motion.div
              className="w-1 h-2 rounded-full bg-emerald-400"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* â”€â”€â”€ BENTO FEATURES GRID â”€â”€â”€ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold mb-4">
              <Shield className="w-4 h-4" />
              {t('security.features.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 mb-4">
              {t('security.features.title')}
            </h2>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto">{t('security.features.subtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featureData.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.key}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -6, boxShadow: '0 20px 60px -10px rgba(0,0,0,0.12)' }}
                  className="group relative p-6 rounded-2xl border border-stone-200 bg-white hover:border-emerald-200 transition-all duration-300 overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-[0.035] transition-opacity duration-300`} />
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 mb-2">{t(`security.${f.key}.title`)}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed">{t(`security.${f.key}.desc`)}</p>
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${f.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* â”€â”€â”€ DEFENSE IN DEPTH + LIVE DASHBOARD â”€â”€â”€ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-stone-50 via-white to-emerald-50/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Layer stack */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold mb-4">
                <Layers className="w-4 h-4" />
                {t('security.layers.title')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 mb-4">{t('security.layers.title')}</h2>
              <p className="text-lg text-stone-600 mb-10">{t('security.layers.subtitle')}</p>

              <div className="space-y-3">
                {layerKeys.map((key, i) => (
                  <motion.button
                    key={key}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => setActiveLayer(activeLayer === i ? null : i)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${
                      activeLayer === i
                        ? 'bg-emerald-50 border-emerald-200 shadow-md'
                        : 'bg-white border-stone-200 hover:border-emerald-200 hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${activeLayer === i ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-500'}`}>
                      {i + 1}
                    </div>
                    <span className={`font-medium text-sm flex-1 ${activeLayer === i ? 'text-emerald-800' : 'text-stone-700'}`}>
                      {t(`security.${key}`)}
                    </span>
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 transition-colors ${activeLayer === i ? 'text-emerald-500' : 'text-stone-300'}`} />
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Live dashboard */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-3xl blur-3xl" />
              <div className="relative p-6 sm:p-8 rounded-3xl bg-white border border-stone-200 shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-stone-100">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-stone-900 text-sm truncate">{t('security.dashboard.title')}</h3>
                    <p className="text-xs text-stone-500">{t('security.dashboard.subtitle')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full flex-shrink-0">
                    <motion.div className="w-2 h-2 rounded-full bg-emerald-500" animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                    <span className="text-xs font-semibold text-emerald-700">Preview</span>
                  </div>
                </div>

                {/* Status bar */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-800">{t('security.dashboard.systemStatus')}</span>
                    <span className="text-xs font-bold text-emerald-700">{t('security.dashboard.allSecure')}</span>
                  </div>
                  <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                      initial={{ width: '0%' }}
                      whileInView={{ width: '100%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 text-center">
                    <p className="text-2xl font-extrabold text-stone-900">TLS<span className="text-base"> 1.3</span></p>
                    <p className="text-xs text-stone-500 mt-0.5">Encryption</p>
                  </div>
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 text-center">
                    <p className="text-2xl font-extrabold text-stone-900">5</p>
                    <p className="text-xs text-stone-500 mt-0.5">{t('security.dashboard.incidents')}</p>
                  </div>
                </div>

                {/* Last scan */}
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-xs text-stone-500">{t('security.dashboard.lastScan')}</span>
                  </div>
                  <p className="text-sm font-semibold text-stone-800">{t('security.dashboard.scanResult')}</p>
                </div>

                {/* Threat bars */}
                <div className="pt-3 border-t border-stone-100">
                  <p className="text-xs font-semibold text-stone-400 mb-3 uppercase tracking-wide">Threat Activity (24 h)</p>
                  {[
                    { label: 'Network', pct: 98, color: 'bg-emerald-500' },
                    { label: 'Application', pct: 100, color: 'bg-teal-500' },
                    { label: 'Data Layer', pct: 100, color: 'bg-emerald-400' },
                  ].map((bar) => (
                    <div key={bar.label} className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-stone-500 w-24 flex-shrink-0">{bar.label}</span>
                      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${bar.color} rounded-full`}
                          initial={{ width: '0%' }}
                          whileInView={{ width: `${bar.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: 0.3 }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 w-8 text-right">{bar.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* â”€â”€â”€ COMPLIANCE GRID â”€â”€â”€ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold mb-4">
              <Award className="w-4 h-4" />
              {t('security.compliance.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 mb-4">
              {t('security.compliance.title')}
            </h2>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto">{t('security.compliance.subtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {complianceCerts.map((cert, i) => {
              const Icon = cert.icon;
              const statusLabel = t(`security.compliance.${cert.statusKey}`);
              return (
                <motion.div
                  key={cert.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -6, boxShadow: '0 16px 48px -8px rgba(0,0,0,0.1)' }}
                  className="flex flex-col items-center p-5 rounded-2xl bg-white border border-stone-200 hover:border-emerald-200 text-center transition-all duration-300 group"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cert.color} flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold text-stone-900 text-sm mb-0.5">{cert.name}</h4>
                  <p className="text-stone-500 text-xs leading-snug mb-3">{certDescriptions[cert.descKey]}</p>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    {statusLabel}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* â”€â”€â”€ SECURITY PRACTICES â”€â”€â”€ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-stone-950">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-semibold mb-4 border border-emerald-500/20">
              <Zap className="w-4 h-4" />
              Security Operations
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">
              {t('security.practices.title')}
            </h2>
            <p className="text-lg text-stone-400 max-w-2xl mx-auto">{t('security.practices.subtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {practiceData.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.key}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="group p-6 rounded-2xl bg-stone-900 border border-stone-800 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/8 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-stone-800 group-hover:bg-emerald-500/15 flex items-center justify-center transition-colors">
                      <Icon className={`w-5 h-5 ${p.color}`} />
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${p.color}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{t(`security.${p.key}.title`)}</h3>
                  <p className="text-stone-400 text-sm leading-relaxed">{t(`security.${p.key}.desc`)}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Trust banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/25 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 3, repeat: Infinity }}>
                <ShieldCheck className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              </motion.div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">{t('security.trust.title')}</h3>
              <p className="text-stone-400 max-w-2xl mx-auto mb-8 text-base sm:text-lg">{t('security.trust.desc')}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/contact">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all"
                  >
                    {t('security.trust.cta1')}
                  </motion.button>
                </Link>
                <Link href="/contact">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-7 py-3.5 bg-stone-800 text-stone-300 rounded-xl font-semibold text-sm border border-stone-700 hover:bg-stone-700 hover:text-white transition-all"
                  >
                    {t('security.trust.cta2')}
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* â”€â”€â”€ CTA â”€â”€â”€ */}
      <CTASection title={t('security.cta.title')} subtitle={t('security.cta.subtitle')} />
    </>
  );
}
