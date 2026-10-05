import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Award, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { Reveal, Magnetic, fadeUp } from './motionPrimitives';
import { PLANS } from './homeData';
import { BASE_API_URL } from '../../config';
import { formatPlanPrice, GST_LABEL } from '../../utils/planPrice';

function withLiveLimits(plan, live) {
  if (!live) return plan;
  return {
    ...plan,
    name: live.name || plan.name,
    monthly: live.price == null ? plan.monthly : live.price,
  };
}

export function PricingSection() {
  const [plans, setPlans] = useState(PLANS);
  const [billing, setBilling] = useState('monthly');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_API_URL}/api/billing/public-plans`);
        const body = await res.json();
        if (!cancelled && res.ok && body.success && Array.isArray(body.data)) {
          const byId = Object.fromEntries(body.data.map((row) => [row.id, row]));
          setPlans(PLANS.map((plan) => withLiveLimits(plan, byId[plan.id])));
        }
      } catch {
        /* keep the catalog shipped with the page */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
      <section id="pricing" className="landing-section relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-white to-teal-50/50" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-200/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto landing-pad relative">
          <Reveal className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6">
              <Award className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">Pricing</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight break-words">
              Simple, transparent pricing
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-stone-600 leading-relaxed">
              Free trial, Starter, Premium, and Custom. List prices exclude GST. All paid plans are billed plus 18% GST.
            </p>
            <div className="mt-6 inline-flex rounded-full border border-stone-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold ${billing === 'monthly' ? 'bg-brand-600 text-white' : 'text-stone-600'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling('annual')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold ${billing === 'annual' ? 'bg-brand-600 text-white' : 'text-stone-600'}`}
              >
                Yearly · 25% off Premium
              </button>
            </div>
          </Reveal>

          <Reveal stagger className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
            {plans.map((plan) => {
              const PlanIcon = plan.icon;
              const yearlyReady = plan.annual != null;
              const price = billing === 'annual' && yearlyReady ? plan.annual : plan.monthly;
              const showYearly = billing === 'annual' && yearlyReady;
              const CardInner = (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <motion.div
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.6 }}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${plan.highlight ? 'bg-gradient-to-br from-brand-500 to-teal-700 shadow-lg shadow-brand-500/30' : 'bg-gradient-to-br from-stone-100 to-stone-200'}`}
                    >
                      <PlanIcon className={`w-6 h-6 ${plan.highlight ? 'text-white' : 'text-stone-600'}`} />
                    </motion.div>
                    <h3 className="text-xl sm:text-2xl font-bold text-stone-900">{plan.name}</h3>
                  </div>
                  <div className="mb-6">
                    {price === null ? (
                      <span className="text-4xl sm:text-5xl font-bold text-stone-900">Custom</span>
                    ) : price === 0 ? (
                      <>
                        <span className="text-4xl sm:text-5xl font-bold text-stone-900">Free</span>
                        <span className="text-stone-500 text-base sm:text-lg"> · 21 days</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl sm:text-4xl font-bold text-stone-900">{formatPlanPrice(price)}</span>
                        <span className="text-stone-500 text-base sm:text-lg">{showYearly ? ' / month, billed yearly' : ' / month'}</span>
                        <p className="text-xs font-semibold text-stone-500 mt-1">{GST_LABEL}</p>
                      </>
                    )}
                  </div>
                  <p className="text-stone-600 mb-8 pb-8 border-b border-stone-100 text-sm sm:text-base leading-relaxed">{plan.tagline}</p>
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start text-stone-700 text-sm sm:text-base min-w-0">
                        <motion.div
                          whileHover={{ scale: 1.2 }}
                          className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shrink-0 mt-0.5 mr-3 shadow-md shadow-brand-500/20"
                        >
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </motion.div>
                        <span className="min-w-0 break-words leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.mail ? (
                    <a href={plan.to} className="btn-secondary w-full block text-center rounded-2xl !py-4">
                      {plan.cta}
                    </a>
                  ) : plan.highlight ? (
                    <Magnetic strength={0.15} className="w-full">
                      <Link to={plan.to} className="btn-cta-primary w-full block text-center rounded-2xl !py-4 shadow-xl shadow-brand-500/30">
                        {plan.cta}
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Link>
                    </Magnetic>
                  ) : (
                    <Link to={plan.to} className="btn-secondary w-full block text-center rounded-2xl !py-4">
                      {plan.cta}
                    </Link>
                  )}
                </>
              );

              if (plan.highlight) {
                return (
                  <div key={plan.id} className="relative pt-6 lg:pt-8 overflow-visible">
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 bg-gradient-to-r from-brand-600 to-teal-700 rounded-full text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-500/30 whitespace-nowrap flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      Most Popular
                    </div>
                    <motion.div variants={fadeUp} className="overflow-visible h-full">
                      <div className="relative bg-white rounded-3xl p-6 sm:p-8 border-2 border-brand-200 shadow-2xl shadow-brand-500/20 overflow-hidden h-full">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-teal-500/5 pointer-events-none" />
                        <div className="relative z-10 flex flex-col h-full">
                          {CardInner}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              }

              return (
                <motion.div
                  key={plan.id}
                  variants={fadeUp}
                  whileHover={{ y: -8 }}
                  className="relative bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xl shadow-stone-200/50 hover:shadow-2xl hover:shadow-brand-500/20 transition-all duration-300 h-full flex flex-col"
                >
                  {CardInner}
                </motion.div>
              );
            })}
          </Reveal>
        </div>
      </section>
  );
}
