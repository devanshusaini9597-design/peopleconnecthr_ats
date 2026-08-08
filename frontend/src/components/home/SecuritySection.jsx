import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, Server, Shield, Check } from 'lucide-react';
import { Reveal } from './motionPrimitives';

export function SecuritySection() {
  return (
      <section id="security" className="landing-section bg-white/70 relative z-10 border-y border-stone-200/70">
        <div className="max-w-7xl mx-auto landing-pad">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <Reveal>
              <div className="section-eyebrow mb-4">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Security
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">Enterprise-grade security for your hiring data</h2>
              <p className="text-base sm:text-lg md:text-xl text-stone-600 mb-6 sm:mb-8 leading-relaxed">
                We treat your candidate and company data with the highest level of security. From tenant isolation to granular access controls, your data is protected.
              </p>

              <div className="space-y-3 sm:space-y-5">
                {[
                  { icon: <Lock className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-100', title: 'End-to-end encryption', desc: 'Data is encrypted at rest and in transit.' },
                  { icon: <Server className="w-5 h-5 text-brand-600" />, bg: 'bg-brand-50 border-brand-100', title: 'Tenant isolation', desc: 'Strict separation of data between organizations.' },
                  { icon: <Shield className="w-5 h-5 text-teal-700" />, bg: 'bg-teal-50 border-teal-100', title: 'Role-based access', desc: 'Granular controls for owners, admins, and interviewers.' },
                  { icon: <Check className="w-5 h-5 text-brand-700" />, bg: 'bg-brand-50 border-brand-100', title: 'Your data, your control (BYOK)', desc: 'Bring your own API keys for integrations.' },
                ].map((item, i) => (
                  <motion.div key={i} whileHover={{ x: 4 }} className="flex items-start gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl hover:bg-stone-50 transition-colors">
                    <div className={`mt-0.5 ${item.bg} p-2 sm:p-2.5 rounded-xl shrink-0 border`}>{item.icon}</div>
                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-base font-semibold text-stone-900 mb-0.5">{item.title}</h4>
                      <p className="text-stone-600 text-sm">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Reveal>

            <Reveal className="relative w-full min-w-0">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-200/40 to-brand-200/40 rounded-full blur-[100px] pointer-events-none"></div>
              <div className="relative bg-white rounded-2xl p-5 sm:p-8 border border-stone-200 shadow-xl overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 pb-6 border-b border-stone-100">
                  <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 shrink-0" />
                  <span className="text-lg sm:text-xl font-semibold text-stone-900 break-words">
                    Security Status:{' '}
                    <span className="text-emerald-600 inline-flex items-center gap-1.5">
                      Secure
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-2 h-2 rounded-full bg-emerald-500"
                      />
                    </span>
                  </span>
                </div>
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 p-3 bg-stone-50 rounded-lg min-w-0">
                    <span className="text-stone-500 shrink-0">Encryption at Rest</span>
                    <span className="text-emerald-600 font-semibold break-all sm:text-right">AES-256 Active</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 p-3 bg-stone-50 rounded-lg min-w-0">
                    <span className="text-stone-500 shrink-0">SOC 2 Compliance</span>
                    <span className="text-amber-600 font-semibold break-all sm:text-right">In Progress</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 p-3 bg-stone-50 rounded-lg min-w-0">
                    <span className="text-stone-500 shrink-0">GDPR Framework</span>
                    <span className="text-emerald-600 font-semibold break-all sm:text-right">Ready</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 p-3 bg-stone-50 rounded-lg min-w-0">
                    <span className="text-stone-500 shrink-0">Audit Logging</span>
                    <span className="text-emerald-600 font-semibold break-all sm:text-right">Enabled</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
  );
}
