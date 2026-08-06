import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Search, Plus, Minus, CircleHelp, ArrowRight, Sparkles } from 'lucide-react';
import { Reveal, Magnetic, fadeUp } from './motionPrimitives';
import { FAQ_CATEGORIES, FAQS, FAQ_CAT_ICON } from './homeData';

export function FaqSection() {
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
    <>
      <section id="faq" className="landing-section relative z-10 bg-white/70 border-y border-stone-200/70 overflow-x-clip">
        <div className="max-w-6xl mx-auto landing-pad min-w-0">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start min-w-0">
            <Reveal className="lg:col-span-4 lg:sticky lg:top-28 min-w-0">
              <div className="section-eyebrow mb-4">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" /> FAQ
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 tracking-tight mb-4 text-balance">
                Answers, without the runaround
              </h2>
              <p className="text-stone-600 text-base sm:text-lg mb-6 leading-relaxed">
                Product, billing, security, and integrations — everything teams ask before they switch.
              </p>

              <div className="relative mb-5 min-w-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  type="search"
                  value={faqQuery}
                  onChange={(e) => updateQuery(e.target.value)}
                  placeholder="Search questions…"
                  className="input-ats !pl-10 !bg-white w-full min-w-0"
                  aria-label="Search FAQ"
                />
              </div>

              <div className="faq-cats-scroll" role="tablist" aria-label="FAQ categories">
                {FAQ_CATEGORIES.map((cat) => {
                  const active = faqCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => selectCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
                        active
                          ? 'bg-gradient-to-r from-brand-600 to-teal-700 text-white border-transparent shadow-md shadow-brand-500/25'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:text-brand-700'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <div className="hidden lg:block mt-8 p-5 rounded-2xl border border-brand-100 bg-brand-50/60">
                <CircleHelp className="w-5 h-5 text-brand-600 mb-2" />
                <p className="text-sm font-semibold text-stone-900 mb-1">Still stuck?</p>
                <p className="text-sm text-stone-600 mb-3 leading-relaxed">
                  Talk to our team — we&apos;ll map People Connect HR to your hiring stages.
                </p>
                <a href="#demo" className="text-sm font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
                  Book a demo <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </Reveal>

            <Reveal stagger className="lg:col-span-8 space-y-3 min-w-0 w-full">
              {filteredFaqs.length === 0 && (
                <motion.div variants={fadeUp} className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 sm:p-8 text-center">
                  <p className="text-stone-600 text-sm">No matching questions. Try another keyword or category.</p>
                </motion.div>
              )}

              {filteredFaqs.map((faq, i) => {
                const open = activeFaq === i;
                const CatIcon = FAQ_CAT_ICON[faq.cat] || HelpCircle;
                return (
                  <motion.div
                    key={`${faq.cat}-${faq.q}`}
                    variants={fadeUp}
                    className={`faq-item-ats ${open ? 'is-open' : ''}`}
                  >
                    {open && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b from-brand-500 to-teal-600" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      onClick={() => toggleFaq(i)}
                      className="faq-item-ats__btn"
                      aria-expanded={open}
                    >
                      <span className={`faq-item-ats__num ${
                        open ? 'bg-gradient-to-br from-brand-500 to-teal-700 text-white shadow-sm shadow-brand-500/30' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span className="faq-item-ats__cat">
                          <CatIcon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{faq.cat}</span>
                        </span>
                        <span className="faq-item-ats__q">{faq.q}</span>
                      </span>
                      <span className={`faq-item-ats__toggle ${
                        open ? 'bg-brand-50 text-brand-700' : 'bg-stone-50 text-stone-400'
                      }`}>
                        {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="faq-item-ats__answer">
                            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 sm:gap-4">
                              <span className="w-9 shrink-0" aria-hidden="true" />
                              <p className="faq-item-ats__answer-inner min-w-0">
                                {faq.a}
                              </p>
                              <span className="w-8 shrink-0" aria-hidden="true" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              <motion.div variants={fadeUp} className="lg:hidden mt-2 p-5 rounded-2xl border border-brand-100 bg-brand-50/60 text-center">
                <p className="text-sm font-semibold text-stone-900 mb-1">Still have questions?</p>
                <a href="#demo" className="text-sm font-semibold text-brand-700 inline-flex items-center justify-center gap-1">
                  Book a demo <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </motion.div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="landing-section relative z-10">
        <div className="max-w-5xl mx-auto landing-pad">
          <Reveal>
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-brand-600 via-teal-700 to-brand-900 bg-[length:200%_200%] animate-aurora p-6 sm:p-10 lg:p-14 text-center shadow-2xl shadow-brand-500/30">
              <div className="absolute inset-0 landing-dot-grid opacity-20" />
              <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-16 -left-10 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 text-brand-100 text-xs sm:text-sm font-semibold mb-4 px-3 py-1 rounded-full bg-white/10 border border-white/15 max-w-full">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Free for 14 days, no card required</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 text-white tracking-tight break-words px-1">Ready to transform your hiring?</h2>
                <p className="text-base sm:text-lg md:text-xl text-brand-50/90 mb-8 sm:mb-10 max-w-2xl mx-auto">
                  Join hundreds of forward-thinking companies building their dream teams with People Connect HR.
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-6 max-w-sm sm:max-w-none mx-auto">
                  <Magnetic className="w-full sm:w-auto">
                    <Link to="/register" className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-white hover:bg-brand-50 text-brand-800 rounded-full font-semibold text-base sm:text-lg transition-all shadow-lg inline-flex items-center justify-center gap-2">
                      Start Free Trial <ArrowRight className="w-5 h-5" />
                    </Link>
                  </Magnetic>
                  <a href="#demo" className="text-brand-100 hover:text-white font-medium flex items-center justify-center transition-colors py-2">
                    Or book a demo <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
