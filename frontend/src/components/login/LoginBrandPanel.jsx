import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import BrandLogo, { BRAND_NAME } from '../ui/BrandLogo';
import { PIPELINE_SEED, fadeUp, staggerContainer } from './loginConstants';
import { PipelineRow } from './PipelineRow';

export default function LoginBrandPanel({ pipelineStages }) {
  return (
    <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative flex-col shrink-0 auth-panel-dark auth-brand-panel">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]">
          <defs>
            <pattern id="loginGrid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginGrid)" />
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
            <span className="text-lg font-bold text-white tracking-tight">
              {BRAND_NAME}
            </span>
          </Link>
        </motion.div>

        <div className="flex-1 flex flex-col justify-center py-6">
          <motion.div initial="hidden" animate="show" variants={staggerContainer}>
            <motion.p
              variants={fadeUp}
              className="text-xs font-semibold tracking-[0.2em] text-brand-300/90 uppercase mb-5"
            >
              Applicant tracking, simplified
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="text-3xl xl:text-[2.5rem] 2xl:text-[2.7rem] font-bold leading-[1.15] text-white mb-5"
            >
              Every candidate,<br />exactly where they<br />are in your pipeline.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-stone-400 text-[15px] leading-relaxed max-w-sm mb-8">
              Sign in to review today&apos;s pipeline, move candidates forward, and keep every hire on track.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 max-w-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-[11px] font-semibold tracking-wider text-stone-300 uppercase">
                  Live pipeline
                </span>
              </div>
              <div>
                {PIPELINE_SEED.map((p, i) => (
                  <PipelineRow key={p.name} name={p.name} role={p.role} stage={pipelineStages[i]} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>

        <div className="shrink-0 text-xs text-stone-500 pt-2">
          © {new Date().getFullYear()} {BRAND_NAME} — built for recruiting teams who move fast.
        </div>
      </div>
    </div>
  );
}
