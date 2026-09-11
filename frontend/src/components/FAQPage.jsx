import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Search, Plus, Minus, CircleHelp, ArrowRight, Sparkles, Mail, Phone, MessageSquare, Clock } from 'lucide-react';
import { Reveal, Magnetic, fadeUp } from './home/motionPrimitives';
import { FAQ_CATEGORIES, FAQS, FAQ_CAT_ICON } from './home/homeData';

export default function FAQPage() {
  const [activeFaq, setActiveFaq] = useState(0);
  const [faqCategory, setFaqCategory] = useState('All');
  const [faqQuery, setFaqQuery] = useState('');

  const toggleFaq = (index) => setActiveFaq(activeFaq === index ? null : index);

  const filteredFaqs = FAQS.filter((faq) => {
    const catOk = faqCategory === 'All' || faq.cat === faqCategory;
    const q = faqQuery.trim().toLowerCase();
    const queryOk = !q || faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q);
    return catOk && queryOk;
  });

  const selectCategory = (cat) => {
    setFaqCategory(cat);
    setActiveFaq(0);
  };

  const updateQuery = (value) => {
    setFaqQuery(value);
    setActiveFaq(0);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-brand-50/50 via-white to-teal-50/50">
      {/* Premium gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-200/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-stone-200/80 bg-white/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ rotate: -8, scale: 1.08 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-brand-500/25 ring-1 ring-brand-500/20 flex-shrink-0"
            >
              <img src="/logo.png" alt="People Connect HR" className="w-full h-full object-cover" />
            </motion.div>
            <span className="text-xl font-bold text-stone-900 tracking-tight group-hover:text-brand-800 transition-colors">
              People Connect HR
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-stone-600 hover:text-brand-700 transition-colors px-4 py-2 rounded-xl hover:bg-brand-50/60">
              Login
            </Link>
            <Magnetic strength={0.2}>
              <Link to="/register" className="btn-cta-primary rounded-full px-5 py-2.5 shadow-lg shadow-brand-500/20">
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Magnetic>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 sm:pt-20 pb-12 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6">
              <HelpCircle className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">Help Center</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">
              Frequently Asked Questions
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-stone-600 leading-relaxed">
              Find answers to common questions about People Connect HR. Can't find what you're looking for? Our team is here to help.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Search and Categories */}
      <section className="relative z-10 pb-12 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" />
              <input
                type="search"
                value={faqQuery}
                onChange={(e) => updateQuery(e.target.value)}
                placeholder="Search questions..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-stone-200/80 bg-white shadow-lg shadow-stone-200/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base transition-all"
                aria-label="Search FAQ"
              />
            </div>
          </Reveal>

          <Reveal className="flex flex-wrap justify-center gap-3 mb-12">
            {FAQ_CATEGORIES.map((cat) => {
              const active = faqCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => selectCategory(cat)}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                    active
                      ? 'bg-gradient-to-r from-brand-600 to-teal-700 text-white border-transparent shadow-lg shadow-brand-500/30'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:text-brand-700 hover:shadow-md'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* FAQ Items */}
      <section className="relative z-10 pb-20 sm:pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal stagger className="space-y-4">
            {filteredFaqs.length === 0 && (
              <motion.div variants={fadeUp} className="rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50 p-8 sm:p-12 text-center">
                <HelpCircle className="w-12 h-12 text-stone-400 mx-auto mb-4" />
                <p className="text-stone-600 text-base">No matching questions. Try another keyword or category.</p>
              </motion.div>
            )}

            {filteredFaqs.map((faq, i) => {
              const open = activeFaq === i;
              const CatIcon = FAQ_CAT_ICON[faq.cat] || HelpCircle;
              return (
                <motion.div
                  key={`${faq.cat}-${faq.q}`}
                  variants={fadeUp}
                  whileHover={{ y: -4 }}
                  className="relative group"
                >
                  <div className="relative bg-white rounded-3xl border border-stone-200/80 shadow-xl shadow-stone-200/50 overflow-hidden">
                    {open && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-500 to-teal-600" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      onClick={() => toggleFaq(i)}
                      className="w-full px-6 sm:px-8 py-5 sm:py-6 flex items-start gap-4 text-left hover:bg-stone-50/50 transition-colors"
                      aria-expanded={open}
                    >
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          open ? 'bg-gradient-to-br from-brand-500 to-teal-600 text-white shadow-lg shadow-brand-500/30' : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        <CatIcon className="w-6 h-6" />
                      </motion.div>
                      <div className="flex-1 min-w-0 pt-1">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 mb-2">
                          {faq.cat}
                        </span>
                        <h3 className="text-base sm:text-lg font-semibold text-stone-900">{faq.q}</h3>
                      </div>
                      <motion.div
                        whileHover={{ rotate: 180 }}
                        transition={{ duration: 0.3 }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          open ? 'bg-brand-50 text-brand-700' : 'bg-stone-50 text-stone-400'
                        }`}
                      >
                        {open ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                            <div className="pl-16">
                              <p className="text-stone-600 leading-relaxed text-sm sm:text-base">{faq.a}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="relative z-10 pb-20 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-brand-600 via-teal-700 to-brand-900 bg-[length:200%_200%] animate-aurora p-8 sm:p-12 lg:p-16 text-center shadow-2xl shadow-brand-500/30">
              <div className="absolute inset-0 landing-dot-grid opacity-20" />
              <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-10 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 text-brand-100 text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/10 border border-white/15">
                  <CircleHelp className="w-4 h-4 shrink-0" />
                  <span>Still have questions?</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-white tracking-tight">
                  Our team is here to help
                </h2>
                <p className="text-base sm:text-lg text-brand-50/90 mb-8 sm:mb-10 max-w-2xl mx-auto">
                  Can't find the answer you're looking for? Reach out to our support team and we'll get back to you within 24 hours.
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                  <Magnetic>
                    <Link to="/contact" className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-brand-50 text-brand-800 rounded-full font-semibold shadow-lg transition-all">
                      Contact Support
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </Magnetic>
                  <a href="mailto:contact@peopleconnecthr.com" className="inline-flex items-center gap-2 text-brand-100 hover:text-white font-medium transition-colors">
                    <Mail className="w-4 h-4" />
                    contact@peopleconnecthr.com
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-stone-500">
            <p>&copy; {new Date().getFullYear()} People Connect HR. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-stone-700 transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-stone-700 transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
