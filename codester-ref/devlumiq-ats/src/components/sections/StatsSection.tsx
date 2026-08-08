'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useLocale } from '@/components/providers/LocaleProvider';

const statConfigs = [
  { value: 50, suffix: '+', labelKey: 'stats.models', duration: 1800 },
  { value: 10, suffix: '', labelKey: 'stats.languages', duration: 2000 },
  { value: 5, suffix: '', labelKey: 'stats.roles', duration: 1600 },
  { value: 33, suffix: '', labelKey: 'stats.permissions', duration: 2200 },
];

function useCountUp(end: number, duration: number, startOn: boolean) {
  const [count, setCount] = useState(0);
  const decimals = end % 1 !== 0 ? 1 : 0;

  useEffect(() => {
    if (!startOn) return;
    let raf: number;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const value = end * easeOut;
      setCount(decimals ? Math.round(value * 10) / 10 : Math.round(value));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [end, duration, startOn, decimals]);

  return count;
}

export default function StatsSection() {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="py-14 sm:py-20 bg-stone-900 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
          {statConfigs.map((config, i) => (
            <StatItem key={config.labelKey} config={config} index={i} startOn={inView} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatItem({
  config,
  index,
  startOn,
  t,
}: {
  config: (typeof statConfigs)[0];
  index: number;
  startOn: boolean;
  t: (k: string) => string;
}) {
  const count = useCountUp(config.value, config.duration, startOn);
  const displayValue = config.suffix === 'K+' ? `${count}${config.suffix}` : `${count}${config.suffix}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="relative text-center group"
    >
      <div className="inline-block">
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.08 + 0.2 }}
          className="block text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-400 to-brand-500"
        >
          {displayValue}
        </motion.span>
        <p className="mt-2 text-sm font-medium text-stone-300">
          {t(config.labelKey)}
        </p>
      </div>
    </motion.div>
  );
}
