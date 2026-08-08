'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, MapPin, Phone, Send, Clock, MessageCircle, Calendar,
  ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown,
  Sparkles, Shield, Users,
} from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { required, email as validateEmail } from '@/lib/validation';

/* â”€â”€â”€ Static data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const contactInfoKeys = [
  { icon: Mail,    titleKey: 'contact.emailTitle',  value: 'support@devlumiq.com',                    descKey: 'contact.emailDesc',  href: 'mailto:support@devlumiq.com', color: 'from-brand-500 to-teal-600',      glow: 'rgba(13,148,136,0.25)'  },
  { icon: Phone,   titleKey: 'contact.phoneTitle',  value: '+1 (555) 123-4567',                           descKey: 'contact.phoneDesc',  href: 'tel:+15551234567',               color: 'from-violet-500 to-purple-600',  glow: 'rgba(139,92,246,0.2)'   },
  { icon: MapPin,  titleKey: 'contact.officeTitle', value: '123 Hiring Street, San Francisco, CA 94105', descKey: 'contact.officeDesc', href: 'https://maps.google.com',        color: 'from-rose-500 to-pink-600',     glow: 'rgba(244,63,94,0.2)'    },
];

const teamAvatars = [
  { name: 'Aisha K.',  initials: 'AK', color: 'bg-brand-500'   },
  { name: 'Rahul M.',  initials: 'RM', color: 'bg-violet-500'  },
  { name: 'Priya S.',  initials: 'PS', color: 'bg-rose-500'    },
  { name: 'James L.',  initials: 'JL', color: 'bg-amber-500'   },
];

const trustBadges = [
  { icon: Shield,       text: 'GDPR ready'           },
  { icon: CheckCircle2, text: 'CCPA ready'            },
  { icon: Users,        text: 'Open-source template'  },
];

/* â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function ContactPage() {
  const [submitted, setSubmitted]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData]     = useState({ name: '', email: '', company: '', topic: '', message: '' });
  const [errors, setErrors]         = useState<{ name?: string; email?: string; message?: string }>({});
  const [topicOpen, setTopicOpen]   = useState(false);
  const { t } = useLocale();
  const toast = useToast();

  const topics = [
    { value: 'general',    label: t('contact.topicGeneral')    },
    { value: 'demo',       label: t('contact.topicDemo')       },
    { value: 'pricing',    label: t('contact.topicPricing')    },
    { value: 'support',    label: t('contact.topicSupport')    },
    { value: 'enterprise', label: t('contact.topicEnterprise') },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const nameErr    = required(formData.name, t('contact.name'));
    const emailErr   = validateEmail(formData.email);
    const messageErr = required(formData.message, t('contact.message'));
    if (nameErr || emailErr || messageErr) {
      setErrors({
        name:    nameErr    ? t('common.required') : undefined,
        email:   emailErr   ? t('validation.emailInvalid') : undefined,
        message: messageErr ? t('common.required') : undefined,
      });
      toast.error(t('contact.error'), nameErr || emailErr || messageErr || undefined);
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      toast.success(t('contact.success'));
      setSubmitted(true);
      setSubmitting(false);
    }, 800);
  };

  return (
    <>
      {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative py-20 sm:py-28 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[#0a0a0a]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(13,148,136,0.18), transparent 60%)' }} />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-brand-500/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] border border-white/10 mb-7"
          >
            <Mail className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-[11px] font-black text-stone-300 uppercase tracking-widest">{t('contact.badge')}</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black text-white tracking-tight leading-[1.08] mb-5"
          >
            {t('contact.title')}
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}
            className="text-stone-400 text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto"
          >
            {t('contact.intro')}
          </motion.p>

          {/* 3-step strip */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0 max-w-2xl mx-auto"
          >
            <div className="hidden sm:block absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
            {(['contact.step1','contact.step2','contact.step3'] as const).map((key, i) => (
              <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.07 }}
                className="relative flex-1 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] backdrop-blur-sm sm:mx-1"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-xs font-black text-white shadow-lg">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-stone-200">{t(key)}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ Main content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

            {/* â”€ Left column (sidebar) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="lg:col-span-2 space-y-4">
              {/* Book demo CTA */}
              <motion.a href="/login" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                whileHover={{ y: -3 }}
                className="group relative flex gap-4 p-5 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 border border-white/[0.07] shadow-xl overflow-hidden cursor-pointer"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.15),transparent_60%)]" />
                <div className="relative flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div className="relative min-w-0 flex-1">
                  <p className="font-black text-white text-sm sm:text-base">Book a 30-min Demo</p>
                  <p className="text-stone-400 text-xs sm:text-sm mt-0.5">Live walkthrough with a product specialist</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-black text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-full">
                    Free &middot; No commitment
                  </div>
                </div>
                <ArrowUpRight className="relative flex-shrink-0 w-4 h-4 text-stone-600 group-hover:text-teal-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all self-start mt-1" />
              </motion.a>

              {/* Contact info cards */}
              {contactInfoKeys.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.a key={item.titleKey} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.06 }}
                    whileHover={{ y: -3 }}
                    className="group relative flex items-start gap-4 p-5 rounded-2xl bg-white border border-stone-200 hover:border-stone-300 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)] transition-all duration-300 cursor-pointer"
                  >
                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-stone-900 text-sm">{t(item.titleKey)}</p>
                      <p className="text-stone-700 text-xs font-medium mt-0.5 truncate">{item.value}</p>
                      <p className="text-stone-400 text-xs mt-0.5">{t(item.descKey)}</p>
                    </div>
                    <ArrowRight className="flex-shrink-0 w-4 h-4 text-stone-300 group-hover:text-stone-500 group-hover:translate-x-1 transition-all self-center" />
                  </motion.a>
                );
              })}

              {/* Response time */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
                className="flex items-center gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-200/80"
              >
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-black text-stone-900 text-sm">{t('contact.responseTime')}</p>
                  <p className="text-stone-600 text-xs mt-0.5">{t('contact.responseDesc')}</p>
                </div>
              </motion.div>

              {/* Team strip */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
                className="p-5 rounded-2xl bg-white border border-stone-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-black text-stone-900">{t('contact.teamLabel')}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{t('contact.teamDesc')}</p>
                  </div>
                  <Sparkles className="w-4 h-4 text-brand-400 flex-shrink-0" />
                </div>
                <div className="flex items-center -space-x-2">
                  {teamAvatars.map((av) => (
                    <div key={av.name} title={av.name}
                      className={`w-9 h-9 rounded-full ${av.color} border-2 border-white flex items-center justify-center flex-shrink-0`}
                    >
                      <span className="text-[10px] font-black text-white">{av.initials}</span>
                    </div>
                  ))}
                  <div className="w-9 h-9 rounded-full bg-stone-100 border-2 border-white flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-black text-stone-500">+5</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {trustBadges.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-50 border border-stone-100 text-[11px] font-semibold text-stone-500">
                      <Icon className="w-3 h-3 text-brand-500" /> {text}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* â”€ Right column (form) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="lg:col-span-3"
            >
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div key="success"
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                    className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-10 sm:p-16 rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 border border-brand-200/60 shadow-[0_8px_48px_-12px_rgba(13,148,136,0.15)]"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-brand-500/15 flex items-center justify-center mb-5">
                      <MessageCircle className="w-8 h-8 text-brand-600" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-stone-900 mb-3">{t('contact.thanksTitle')}</h3>
                    <p className="text-stone-600 max-w-sm">{t('contact.thanksDesc')}</p>
                    <button onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', company: '', topic: '', message: '' }); }}
                      className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700"
                    >
                      <ArrowRight className="w-4 h-4 rotate-180" /> Send another message
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="rounded-2xl bg-white border border-stone-200 shadow-[0_8px_48px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
                      {/* Form header */}
                      <div className="px-6 sm:px-8 pt-7 pb-6 border-b border-stone-100">
                        <h3 className="text-xl sm:text-2xl font-black text-stone-900">{t('contact.formTitle')}</h3>
                        <p className="text-stone-500 text-sm mt-1">{t('contact.intro').split('.')[0]}.</p>
                      </div>

                      <form onSubmit={handleSubmit} className="p-6 sm:p-8">
                        <div className="space-y-5">
                          {/* Name + Email row */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="c-name" className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-2">{t('contact.name')}</label>
                              <input id="c-name" type="text" value={formData.name}
                                onChange={(e) => { setFormData(p => ({ ...p, name: e.target.value })); setErrors(er => ({ ...er, name: undefined })); }}
                                placeholder={t('contact.namePlaceholder')}
                                className={`w-full px-4 py-3 rounded-xl border text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all ${errors.name ? 'border-red-400' : 'border-stone-200 focus:border-brand-400'}`}
                                aria-invalid={!!errors.name}
                              />
                              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                            </div>
                            <div>
                              <label htmlFor="c-email" className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-2">{t('contact.email')}</label>
                              <input id="c-email" type="email" value={formData.email}
                                onChange={(e) => { setFormData(p => ({ ...p, email: e.target.value })); setErrors(er => ({ ...er, email: undefined })); }}
                                placeholder={t('contact.emailPlaceholder')}
                                className={`w-full px-4 py-3 rounded-xl border text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all ${errors.email ? 'border-red-400' : 'border-stone-200 focus:border-brand-400'}`}
                                aria-invalid={!!errors.email}
                              />
                              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                            </div>
                          </div>

                          {/* Company + Topic row */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="c-company" className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-2">{t('contact.company')}</label>
                              <input id="c-company" type="text" value={formData.company}
                                onChange={(e) => setFormData(p => ({ ...p, company: e.target.value }))}
                                placeholder={t('contact.companyPlaceholder')}
                                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-400 text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-2">{t('contact.topicLabel')}</label>
                              <div className="relative">
                                <button type="button" onClick={() => setTopicOpen(o => !o)}
                                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-400 text-sm bg-stone-50 focus:bg-white outline-none transition-all flex items-center justify-between text-left"
                                >
                                  <span className={formData.topic ? 'text-stone-900' : 'text-stone-400'}>
                                    {formData.topic ? topics.find(t => t.value === formData.topic)?.label : t('contact.topicGeneral')}
                                  </span>
                                  <motion.div animate={{ rotate: topicOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
                                    <ChevronDown className="w-4 h-4 text-stone-400" />
                                  </motion.div>
                                </button>
                                <AnimatePresence>
                                  {topicOpen && (
                                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                                      className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-20 overflow-hidden"
                                    >
                                      {topics.map((opt) => (
                                        <button key={opt.value} type="button" onClick={() => { setFormData(p => ({ ...p, topic: opt.value })); setTopicOpen(false); }}
                                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${formData.topic === opt.value ? 'bg-brand-50 text-brand-700 font-bold' : 'text-stone-700 hover:bg-stone-50'}`}
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>

                          {/* Message */}
                          <div>
                            <label htmlFor="c-message" className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-2">{t('contact.message')}</label>
                            <textarea id="c-message" value={formData.message} rows={5}
                              onChange={(e) => { setFormData(p => ({ ...p, message: e.target.value })); setErrors(er => ({ ...er, message: undefined })); }}
                              placeholder={t('contact.messagePlaceholder')}
                              className={`w-full px-4 py-3 rounded-xl border text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none resize-none transition-all ${errors.message ? 'border-red-400' : 'border-stone-200 focus:border-brand-400'}`}
                              aria-invalid={!!errors.message}
                            />
                            {errors.message && <p className="text-xs text-red-600 mt-1">{errors.message}</p>}
                          </div>

                          {/* Submit */}
                          <motion.button type="submit" disabled={submitting}
                            whileHover={{ scale: submitting ? 1 : 1.01 }} whileTap={{ scale: 0.98 }}
                            className="w-full min-h-[52px] py-4 rounded-xl font-black text-white text-sm bg-gradient-to-r from-brand-600 to-teal-600 shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2.5 disabled:opacity-70 transition-all hover:shadow-brand-500/40"
                          >
                            {submitting ? (
                              <>
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                  className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full"
                                />
                                {t('contact.sending')}
                              </>
                            ) : (
                              <><Send className="w-4 h-4" /> {t('contact.sendMessage')}</>
                            )}
                          </motion.button>

                          <p className="text-center text-[11px] text-stone-400">
                            We respect your privacy. No spam, ever.
                          </p>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </section>

      {/* â”€â”€ CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <CTASection title={t('contact.ctaTitle')} subtitle={t('contact.ctaSubtitle')} />
    </>
  );
}
