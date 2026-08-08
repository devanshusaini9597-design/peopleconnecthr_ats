import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, Sparkles, Check, CheckCircle2 } from 'lucide-react';
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
    window.location.href = `mailto:sales@skillnix.app?subject=${subject}&body=${body}`;
  };

  return (
      <section id="demo" className="landing-section bg-stone-50/80 border-y border-stone-200/70 relative z-10">
        <div className="max-w-6xl mx-auto landing-pad">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <Reveal>
              <div className="section-eyebrow mb-4">
                <Sparkles className="w-3.5 h-3.5 shrink-0" /> Talk to us
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-4 sm:mb-5 tracking-tight">Want a walkthrough instead?</h2>
              <p className="text-base sm:text-lg text-stone-600 mb-6 sm:mb-8 leading-relaxed">
                Tell us a bit about your team and we'll set up a live demo tailored to your hiring workflow — no generic slide deck.
              </p>
              <ul className="space-y-3 sm:space-y-4">
                {[
                  '30-minute call, tailored to your hiring stages',
                  'See white-labeling & SSO if you\'re evaluating for Enterprise',
                  'No pressure — cancel or reschedule anytime',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-stone-700">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-brand-700" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal>
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xl p-5 sm:p-8">
                {demoSent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-10"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
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
                  <form onSubmit={handleDemoSubmit} className="space-y-5" noValidate>
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="demo-name" className="label-ats">Full name</label>
                        <input
                          id="demo-name"
                          type="text" required value={demoForm.name} onChange={updateDemoForm('name')}
                          placeholder="Jordan Lee"
                          className="input-ats"
                          autoComplete="name"
                          aria-required="true"
                        />
                      </div>
                      <div>
                        <label htmlFor="demo-email" className="label-ats">Work email</label>
                        <input
                          id="demo-email"
                          type="email" required value={demoForm.email} onChange={updateDemoForm('email')}
                          placeholder="jordan@company.com"
                          className="input-ats"
                          autoComplete="email"
                          aria-required="true"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="demo-company" className="label-ats">Company</label>
                      <input
                        id="demo-company"
                        type="text" required value={demoForm.company} onChange={updateDemoForm('company')}
                        placeholder="Acme Inc."
                        className="input-ats"
                        autoComplete="organization"
                        aria-required="true"
                      />
                    </div>
                    <div>
                      <label htmlFor="demo-team-size" className="label-ats">Team size</label>
                      <select
                        id="demo-team-size"
                        value={demoForm.teamSize} onChange={updateDemoForm('teamSize')}
                        className="select-ats"
                      >
                        <option>1-10</option>
                        <option>11-50</option>
                        <option>51-200</option>
                        <option>201-1000</option>
                        <option>1000+</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="demo-message" className="label-ats">What are you hoping to solve? <span className="text-stone-400 font-normal">(optional)</span></label>
                      <textarea
                        id="demo-message"
                        rows={3} value={demoForm.message} onChange={updateDemoForm('message')}
                        placeholder="We're outgrowing our spreadsheet-based process..."
                        className="textarea-ats"
                      />
                    </div>
                    <Magnetic strength={0.15} className="w-full block">
                      <button type="submit" className="btn-cta-primary w-full rounded-xl inline-flex items-center justify-center gap-2 !py-3">
                        Request a Demo <Send className="w-4 h-4" aria-hidden="true" />
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
  );
}
