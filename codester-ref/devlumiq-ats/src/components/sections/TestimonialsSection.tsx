'use client';

import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';
import { useLocale } from '@/components/providers/LocaleProvider';

// ─── Data ────────────────────────────────────────────────────────────────────
const testimonials = [
  {
    quote: "We like how the pipeline stays organized and keeps the team aligned during hiring.",
    author: 'Alex R.',
    role: 'HR Director',
    company: 'Sample feedback',
    avatar: 'AR',
    gradient: 'from-brand-500 to-teal-600',
    rating: 5,
    featured: true,
  },
  {
    quote: "The Kanban workflow makes it easier to review candidates and move them forward without confusion.",
    author: 'Jordan M.',
    role: 'Head of Talent',
    company: 'Sample feedback',
    avatar: 'JM',
    gradient: 'from-violet-500 to-purple-600',
    rating: 5,
    featured: false,
  },
  {
    quote: "We scaled our recruiting processes and kept collaboration smooth across teams.",
    author: 'Sam P.',
    role: 'VP of People',
    company: 'Sample feedback',
    avatar: 'SP',
    gradient: 'from-rose-500 to-pink-600',
    rating: 5,
    featured: false,
  },
  {
    quote: "The reporting helps us understand what's happening in the hiring pipeline and plan next steps.",
    author: 'Taylor K.',
    role: 'Recruiting Lead',
    company: 'Sample feedback',
    avatar: 'TK',
    gradient: 'from-amber-500 to-orange-600',
    rating: 5,
    featured: false,
  },
  {
    quote: "The migration experience was manageable, and our job posts look polished for candidates.",
    author: 'Casey L.',
    role: 'Talent Operations',
    company: 'Sample feedback',
    avatar: 'CL',
    gradient: 'from-cyan-500 to-blue-600',
    rating: 5,
    featured: false,
  },
  {
    quote: "Our recruiters find the system intuitive and useful day to day.",
    author: 'Morgan S.',
    role: 'Chief People Officer',
    company: 'Sample feedback',
    avatar: 'MS',
    gradient: 'from-emerald-500 to-teal-600',
    rating: 5,
  },
  {
    quote: "Candidate matching and scoring help our team focus on the most relevant profiles.",
    author: 'Riley N.',
    role: 'Talent Acquisition Lead',
    company: 'Sample feedback',
    avatar: 'RN',
    gradient: 'from-fuchsia-500 to-pink-600',
    rating: 5,
  },
  {
    quote: "Onboarding was straightforward and our team became productive quickly.",
    author: 'Jamie T.',
    role: 'Recruiting Manager',
    company: 'Sample feedback',
    avatar: 'JT',
    gradient: 'from-sky-500 to-blue-600',
    rating: 5,
  },
];

// Split into two rows for the dual marquee
const row1 = testimonials.slice(0, 4);
const row2 = testimonials.slice(4);

// ─── Single card ─────────────────────────────────────────────────────────────
function TestimonialCard({ t: card }: { t: (typeof testimonials)[0] }) {
  return (
    <div className="relative flex-shrink-0 w-[272px] sm:w-[316px] bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.07)] p-5 mx-2.5 hover:border-brand-200/70 hover:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.12)] transition-all duration-300 group">
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-400/5 via-transparent to-teal-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      {/* Stars */}
      <div className="flex items-center gap-0.5 mb-3">
        {[...Array(card.rating)].map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
        ))}
      </div>
      {/* Quote */}
      <div className="relative mb-4">
        <Quote className="absolute -top-1 -left-0.5 w-5 h-5 text-brand-100 stroke-[1.5]" />
        <p className="text-[13px] text-stone-600 leading-relaxed pl-5 line-clamp-3">
          {card.quote}
        </p>
      </div>
      {/* Author */}
      <div className="flex items-center gap-2.5 pt-3 border-t border-stone-100">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center font-bold text-white text-[10px] flex-shrink-0 shadow-sm`}>
          {card.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-stone-900 text-xs leading-tight">{card.author}</p>
          <p className="text-stone-400 text-[10px] truncate">{card.role}</p>
        </div>
        <span className="flex-shrink-0 px-2 py-0.5 rounded-md bg-stone-100 text-stone-500 text-[10px] font-semibold">
          {card.company}
        </span>
      </div>
    </div>
  );
}

// ─── Marquee row ──────────────────────────────────────────────────────────────
// Uses CSS animation for guaranteed smoothness & GPU compositing on all devices.
// Two identical sets side-by-side: animate translates exactly one set width so
// the loop is perfectly seamless — no jump, no fade, no pause.
function MarqueeRow({ items, reverse = false }: { items: typeof testimonials; reverse?: boolean }) {
  const animName = reverse ? 'marquee-rtl' : 'marquee-ltr';
  const duration = `${items.length * 9}s`;
  // Double the items — when the first set scrolls fully off screen, the second
  // set is in exactly the starting position, creating a seamless infinite loop.
  const doubled = [...items, ...items];
  return (
    <div className="flex overflow-hidden" style={{ willChange: 'transform' }}>
      <div
        className="flex flex-shrink-0"
        style={{
          animation: `${animName} ${duration} linear infinite`,
        }}
      >
        {doubled.map((card, i) => (
          <TestimonialCard key={`${card.author}-${i}`} t={card} />
        ))}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
export default function TestimonialsSection() {
  const { t } = useLocale();
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-stone-50 via-white to-stone-50 overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgb(13 148 136) 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10 sm:mb-14">
        <SectionHeading
          icon={Star}
          title={t('home.testimonialsTitle')}
          subtitle={t('home.testimonialsDesc')}
        />
        <p className="mt-3 text-xs text-stone-400 font-medium">
          Example testimonials — customize with your own customer feedback
        </p>
      </div>

      {/* Trust bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="max-w-xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-10 sm:mb-14"
      >
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
          </div>
          <span className="font-bold text-stone-900 text-sm">Trusted</span>
          <span className="text-stone-500 text-xs">by teams</span>
        </div>
        <div className="w-px h-4 bg-stone-200 hidden sm:block" />
        <span className="text-sm text-stone-500">Customer feedback</span>
        <div className="w-px h-4 bg-stone-200 hidden sm:block" />
        <span className="text-sm text-stone-500">Real-world hiring teams</span>
        <div className="w-px h-4 bg-stone-200 hidden sm:block" />
        <span className="text-sm text-stone-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-stone-800">Satisfaction-focused</span>
        </span>
      </motion.div>

      {/* Marquee — Row 1 scrolls left */}
      <div className="relative mb-3.5 overflow-hidden">
        <MarqueeRow items={row1} />
      </div>

      {/* Marquee — Row 2 scrolls right */}
      <div className="relative overflow-hidden">
        <MarqueeRow items={row2} reverse />
      </div>
    </section>
  );
}
