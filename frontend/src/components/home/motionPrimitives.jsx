import React, { useState, useEffect, useRef } from 'react';
import {
  motion, useMotionValue, useSpring, useMotionTemplate, useReducedMotion, useTransform,
} from 'motion/react';

/* ============================================================
   Reusable motion primitives
   ============================================================ */

export const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

/** Scroll-triggered reveal wrapper. Pass `stagger` to orchestrate motion.div children. */
export const Reveal = ({ children, className = '', stagger = false, amount = 0.2, ...rest }) => (
  <motion.div
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, amount }}
    variants={stagger ? staggerContainer : fadeUp}
    className={className}
    {...rest}
  >
    {children}
  </motion.div>
);

/** Cursor-follow spotlight glow, revealed on hover — tinted to the brand teal. */
export const SpotlightCard = ({ children, className = '' }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const background = useMotionTemplate`radial-gradient(420px circle at ${mouseX}px ${mouseY}px, rgba(13,148,136,0.14), transparent 75%)`;

  return (
    <motion.div
      variants={fadeUp}
      onMouseMove={handleMouseMove}
      className={`group relative ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
};

/** Subtle 3D tilt that follows the cursor, with spring smoothing. */
export const TiltCard = ({ children, className = '' }) => {
  const prefersReduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springCfg = { stiffness: 150, damping: 20, mass: 0.6 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], ['5deg', '-5deg']), springCfg);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], ['-5deg', '5deg']), springCfg);

  const handleMouseMove = (e) => {
    if (prefersReduced || window.matchMedia('(max-width: 1023px)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={prefersReduced ? undefined : { rotateX, rotateY, transformPerspective: 1200 }}
      className={`${className} [transform-style:preserve-3d]`}
    >
      {children}
    </motion.div>
  );
};

/** Wraps a button/link and gently pulls it toward the cursor. */
export const Magnetic = ({ children, strength = 0.3, className = '' }) => {
  const prefersReduced = useReducedMotion();
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 16, mass: 0.2 });
  const springY = useSpring(y, { stiffness: 200, damping: 16, mass: 0.2 });

  const handleMouseMove = (e) => {
    if (prefersReduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  const stretch = /\b(w-full|block)\b/.test(className);
  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={prefersReduced ? undefined : { x: springX, y: springY }}
      className={`${stretch ? 'block' : 'inline-block'} ${className}`}
    >
      {children}
    </motion.div>
  );
};

/* ---------- Animated count-up stat ---------- */
export const useInView = (threshold = 0.4) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(node);
        }
      },
      { threshold }
    );
    observer.observe(node);
    return () => observer.unobserve(node);
  }, [threshold]);

  return [ref, inView];
};

export const CountUpStat = ({ end, suffix = '', decimals = 0, duration = 1500, label, icon, color }) => {
  const [ref, inView] = useInView();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(end);
      return;
    }
    let start = null;
    let frame;
    const step = (timestamp) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(end * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else setValue(end);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, end, duration]);

  return (
    <motion.div ref={ref} variants={fadeUp} className="flex flex-col items-center text-center">
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-3xl sm:text-4xl font-bold text-stone-900 mb-1 tabular-nums">
        {value.toFixed(decimals)}{suffix}
      </div>
      <div className="text-xs sm:text-sm text-stone-500 font-medium px-1">{label}</div>
    </motion.div>
  );
};

/** Dependency-free animated mini area chart — draws itself in on scroll. */
export const MiniAreaChart = ({ data, width = 300, height = 130, color = '#0d9488' }) => {
  const padding = 8;
  const values = data.map((d) => d.v);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (data.length - 1);
  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = padding + (1 - (d.v - min) / range) * (height - padding * 2);
    return [x, y];
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0]},${height - padding} L${points[0][0]},${height - padding} Z`;
  const gradId = 'miniAreaGrad';
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${gradId})`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.3 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r="4.5"
        fill={color}
        stroke="white"
        strokeWidth="2"
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1, type: 'spring', stiffness: 320, damping: 14 }}
      />
    </svg>
  );
};
