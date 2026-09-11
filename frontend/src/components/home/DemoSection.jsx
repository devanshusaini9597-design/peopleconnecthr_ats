import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, Sparkles, Check, CheckCircle2, ArrowRight, Phone, Clock, Users } from 'lucide-react';
import { Reveal, Magnetic } from './motionPrimitives';

export function DemoSection() {
  const [demoForm, setDemoForm] = useState({
    name: '', email: '', company: '', teamSize: '1-10', message: '',
  });
  const [demoSent, setDemoSent] = useState(false);
  const updateDemoForm = (field) => (e) => setDemoForm((f) => ({ ...f, [field]: e.target.value }));

  const handleDemoSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Demo request — ${demoForm.company || demoForm.name}`);
    const body = encodeURIComponent(
      `Name: ${demoForm.name}\nWork email: ${demoForm.email}\nCompany: ${demoForm.company}\nTeam size: ${demoForm.teamSize}\n\nMessage:\n${demoForm.message || '(none)'}`
    );
    setDemoSent(true);
    window.location.href = `mailto:contact@peopleconnecthr.com?subject=${subject}&body=${body}`;
  };

  return (
      <section id="demo" className="landing-section relative z-10 overflow-hidden">
        {/* Premium gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-white to-teal-50/50" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-brand-200/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-6xl mx-auto landing-pad relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-semibold text-brand-700">Talk to us</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-stone-900 mb-4 sm:mb-6 tracking-tight">
                Want a walkthrough instead?
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-stone-600 mb-8 sm:mb-10 leading-relaxed">
                Tell us a bit about your team and we'll set up a live demo tailored to your hiring workflow — no generic slide deck.
              </p>
              
              <div className="space-y-4 sm:space-y-5 mb-8">
                {[
                  { icon: Clock, text: '30-minute call, tailored to your hiring stages' },
                  { icon: Users, text: 'See white-labeling & SSO if you\'re evaluating for Enterprise' },
                  { icon: Phone, text: 'No pressure — cancel or reschedule anytime' },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={i}
                      whileHover={{ x: 8 }}
                      className="flex items-start gap-4 text-sm sm:text-base text-stone-700"
                    >
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30 mt-0.5"
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </motion.div>
                      <span className="leading-relaxed pt-1.5">{item.text}</span>
                    </motion.div>
                  );
                })}
              </div>
            </Reveal>

            <Reveal>
              <motion.div
                whileHover={{ y: -8 }}
                className="relative bg-white rounded-3xl border border-stone-200/80 shadow-2xl shadow-stone-200/50 p-6 sm:p-8 lg:p-10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-teal-500/5 pointer-events-none rounded-3xl" />
                <div className="relative z-10">
                  {demoSent ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-12"
                    >
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30"
                      >
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      </motion.div>
                      <h3 className="text-xl font-bold text-stone-900 mb-3">Your email client should be open</h3>
                      <p className="text-stone-600 text-base mb-8 leading-relaxed">
                        Finish sending from there and our team will get back to you within one business day.
                      </p>
                      <button onClick={() => setDemoSent(false)} className="text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors">
                        ← Back to the form
                      </button>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleDemoSubmit} className="space-y-5" noValidate>
                      <div className="grid sm:grid-cols-2 gap-5">
                        <div>
                          <label htmlFor="demo-name" className="block text-sm font-semibold text-stone-700 mb-2">Full name</label>
                          <input
                            id="demo-name"
                            type="text" required value={demoForm.name} onChange={updateDemoForm('name')}
                            placeholder="Jordan Lee"
                            className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                            autoComplete="name"
                            aria-required="true"
                          />
                        </div>
                        <div>
                          <label htmlFor="demo-email" className="block text-sm font-semibold text-stone-700 mb-2">Work email</label>
                          <input
                            id="demo-email"
                            type="email" required value={demoForm.email} onChange={updateDemoForm('email')}
                            placeholder="jordan@company.com"
                            className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                            autoComplete="email"
                            aria-required="true"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="demo-company" className="block text-sm font-semibold text-stone-700 mb-2">Company</label>
                        <input
                          id="demo-company"
                          type="text" required value={demoForm.company} onChange={updateDemoForm('company')}
                          placeholder="Acme Inc."
                          className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                          autoComplete="organization"
                          aria-required="true"
                        />
                      </div>
                      <div>
                        <label htmlFor="demo-team-size" className="block text-sm font-semibold text-stone-700 mb-2">Team size</label>
                        <select
                          id="demo-team-size"
                          value={demoForm.teamSize} onChange={updateDemoForm('teamSize')}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                        >
                          <option>1-10</option>
                          <option>11-50</option>
                          <option>51-200</option>
                          <option>201-1000</option>
                          <option>1000+</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="demo-message" className="block text-sm font-semibold text-stone-700 mb-2">
                          What are you hoping to solve? <span className="text-stone-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                          id="demo-message"
                          rows={4} value={demoForm.message} onChange={updateDemoForm('message')}
                          placeholder="We're outgrowing our spreadsheet-based process..."
                          className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none"
                        />
                      </div>
                      <Magnetic strength={0.15} className="w-full block">
                        <button type="submit" className="btn-cta-primary w-full rounded-2xl inline-flex items-center justify-center gap-2 !py-4 shadow-xl shadow-brand-500/30">
                          Request a Demo <Send className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </Magnetic>
                      <p className="text-xs text-stone-500 text-center">
                        We'll open your email client with this pre-filled, ready to send to our team.
                      </p>
                    </form>
                  )}
                </div>
              </motion.div>
            </Reveal>
          </div>
        </div>
      </section>
  );
}
