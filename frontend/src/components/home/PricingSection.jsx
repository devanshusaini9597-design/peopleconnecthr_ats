import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Award, CheckCircle2 } from 'lucide-react';
import { Reveal, Magnetic, fadeUp } from './motionPrimitives';
import { PLANS } from './homeData';

export function PricingSection() {
  const [billing, setBilling] = useState('monthly');
  return (
      <section id="pricing" className="landing-section relative z-10 overflow-visible">
        <div className="max-w-7xl mx-auto landing-pad overflow-visible">
          <Reveal className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
            <div className="section-eyebrow mb-4 mx-auto">
              <Award className="w-3.5 h-3.5 shrink-0" /> Pricing
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight break-words">Simple, transparent pricing</h2>
            <p className="text-base sm:text-lg md:text-xl text-stone-600">Start for free, upgrade when you need more power.</p>
          </Reveal>

          <Reveal className="flex justify-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-1 p-1 sm:p-1.5 rounded-full bg-stone-100 border border-stone-200">
              {['monthly', 'annual'].map((cycle) => {
                const active = billing === cycle;
                return (
                  <button
                    key={cycle}
                    onClick={() => setBilling(cycle)}
                    className={`relative flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors touch-target ${
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

          <Reveal stagger className="grid lg:grid-cols-3 gap-5 sm:gap-8 max-w-6xl mx-auto items-stretch lg:items-center">
            {PLANS.map((plan) => {
              const PlanIcon = plan.icon;
              const price = billing === 'annual' ? plan.annual : plan.monthly;
              const CardInner = (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${plan.highlight ? 'bg-gradient-to-br from-brand-500 to-teal-700' : 'bg-stone-100'}`}>
                      <PlanIcon className={`w-5 h-5 ${plan.highlight ? 'text-white' : 'text-stone-600'}`} />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-semibold text-stone-900">{plan.name}</h3>
                  </div>
                  <div className="mb-4">
                    {price === null ? (
                      <span className="text-3xl sm:text-4xl font-bold text-stone-900">Custom</span>
                    ) : price === 0 ? (
                      <>
                        <span className="text-3xl sm:text-4xl font-bold text-stone-900">$0</span>
                        <span className="text-stone-500 text-sm sm:text-base"> / Free Trial</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl sm:text-4xl font-bold text-stone-900">${price}</span>
                        <span className="text-stone-500 text-sm sm:text-base"> / mo{billing === 'annual' ? ', billed annually' : ''}</span>
                      </>
                    )}
                  </div>
                  <p className="text-stone-600 mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-stone-100 text-sm sm:text-base">{plan.tagline}</p>
                  <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 flex-1">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start text-stone-700 text-sm sm:text-base min-w-0">
                        <CheckCircle2 className="w-5 h-5 text-brand-500 mr-2.5 sm:mr-3 shrink-0 mt-0.5" />
                        <span className="min-w-0 break-words">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.mail ? (
                    <a href={plan.to} className="btn-secondary w-full block text-center rounded-xl">
                      {plan.cta}
                    </a>
                  ) : plan.highlight ? (
                    <Magnetic strength={0.15} className="w-full">
                      <Link to={plan.to} className="btn-cta-primary w-full block text-center rounded-xl">
                        {plan.cta}
                      </Link>
                    </Magnetic>
                  ) : (
                    <Link to={plan.to} className="btn-secondary w-full block text-center rounded-xl">
                      {plan.cta}
                    </Link>
                  )}
                </>
              );

              if (plan.highlight) {
                return (
                  <div key={plan.id} className="relative pt-5 lg:pt-6 lg:-translate-y-4 lg:hover:-translate-y-6 transition-transform duration-300 ease-out overflow-visible">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 sm:px-4 py-1 bg-gradient-to-r from-brand-600 to-teal-700 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white shadow-md shadow-brand-500/30 whitespace-nowrap">
                      Most Popular
                    </div>
                    <motion.div variants={fadeUp} className="overflow-visible">
                      <div className="gradient-border-wrap shadow-xl shadow-brand-500/15 overflow-hidden rounded-3xl">
                        <div className="gradient-border-inner relative p-5 sm:p-8 pt-8 sm:pt-10 flex flex-col h-full">
                          {CardInner}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              }

              return (
                <motion.div key={plan.id} variants={fadeUp} whileHover={{ y: -6 }} className="card-ats p-5 sm:p-8 h-full flex flex-col">
                  {CardInner}
                </motion.div>
              );
            })}
          </Reveal>
        </div>
      </section>
  );
}
