import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import BrandLogo, { BRAND_NAME } from '../ui/BrandLogo';
import { fadeUp, staggerContainer, FEATURES, CHECKLIST } from './registerConstants';

export default function RegisterBrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative flex-col shrink-0 auth-panel-dark auth-brand-panel">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]">
          <defs>
            <pattern id="registerGrid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#registerGrid)" />
        </svg>
        <div className="absolute -top-24 -left-16 w-[26rem] h-[26rem] rounded-full bg-teal-500/20 blur-[110px]" />
        <div className="absolute -bottom-20 -right-10 w-[22rem] h-[22rem] rounded-full bg-brand-600/15 blur-[100px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-stone-950/80 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 px-8 xl:px-12 2xl:px-14 py-8 xl:py-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="shrink-0"
        >
          <Link to="/" className="inline-flex items-center gap-2.5">
            <BrandLogo size="md" shadow />
            <span className="text-lg font-bold text-white tracking-tight">{BRAND_NAME}</span>
          </Link>
        </motion.div>

        <div className="flex-1 flex flex-col justify-center py-6">
          <motion.div initial="hidden" animate="show" variants={staggerContainer}>
            <motion.p
              variants={fadeUp}
              className="text-xs font-semibold tracking-[0.2em] text-brand-300/90 uppercase mb-5"
            >
              Start hiring smarter
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="text-3xl xl:text-[2.5rem] 2xl:text-[2.7rem] font-bold leading-[1.15] text-white mb-5"
            >
              The intelligent ATS<br />for modern<br />hiring teams.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-stone-400 text-[15px] leading-relaxed max-w-sm mb-8">
              Streamline sourcing, screening, and offers with a secure, scalable applicant tracking platform.
            </motion.p>

            <motion.div variants={fadeUp} className="space-y-4 mb-6">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-sm shrink-0">
                    <Icon className="w-5 h-5 text-brand-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-[15px]">{title}</h3>
                    <p className="text-stone-400 text-sm">{description}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 max-w-sm"
            >
              <p className="text-[11px] font-semibold tracking-wider text-stone-300 uppercase mb-3">
                Getting started
              </p>
              <ul className="space-y-2.5">
                {CHECKLIST.map((item, i) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-stone-300">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      i === 0
                        ? 'bg-gradient-to-br from-brand-500 to-teal-600 text-white'
                        : 'bg-white/10 text-stone-500'
                    }`}>
                      {i === 0 ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-semibold">{i + 1}</span>}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>

        <div className="shrink-0 text-xs text-stone-500 pt-2">
          © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </div>
      </div>
    </div>
  );
}
