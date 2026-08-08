'use client';

import { LayoutDashboard } from 'lucide-react';

/**
 * Lottie-style continuous background: floating gradient orbs + ghost icons.
 * Smooth, organic, infinite animations - no external Lottie JSON needed.
 */
export default function DashboardLottieBackground() {
  const orbs = [
    { size: 120, x: '10%', y: '20%', delay: 0, duration: 18 },
    { size: 80, x: '75%', y: '15%', delay: 2, duration: 22 },
    { size: 100, x: '50%', y: '70%', delay: 4, duration: 20 },
    { size: 60, x: '25%', y: '60%', delay: 1, duration: 16 },
    { size: 90, x: '85%', y: '55%', delay: 3, duration: 24 },
    { size: 70, x: '15%', y: '80%', delay: 5, duration: 19 },
    { size: 110, x: '60%', y: '30%', delay: 2.5, duration: 21 },
    { size: 50, x: '35%', y: '40%', delay: 1.5, duration: 17 },
    { size: 85, x: '90%', y: '75%', delay: 4.5, duration: 23 },
    { size: 95, x: '5%', y: '45%', delay: 0.5, duration: 25 },
    { size: 65, x: '70%', y: '90%', delay: 3.5, duration: 20 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Layer 1: Soft gradient orbs - Lottie-style floating blobs */}
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-gradient-to-br from-brand-300/25 via-brand-400/15 to-teal-500/20"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            transform: 'translate(-50%, -50%)',
            animation: `floatSlow ${orb.duration}s ease-in-out infinite`,
            animationDelay: `${orb.delay}s`,
            filter: 'blur(40px)',
          }}
        />
      ))}

      {/* Layer 2: Marquee ghost icons - continuous horizontal flow */}
      <div className="absolute inset-0 flex animate-marquee" style={{ width: '200%' }}>
        <div className="flex shrink-0 gap-12 items-center py-6" style={{ width: '50%' }}>
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="flex shrink-0 items-center justify-center opacity-[0.06]"
              style={{ animation: `float 4s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }}
            >
              <LayoutDashboard className="w-14 h-14 sm:w-20 sm:h-20 text-brand-600" strokeWidth={1.5} />
            </div>
          ))}
        </div>
        <div className="flex shrink-0 gap-12 items-center py-6" style={{ width: '50%' }}>
          {[...Array(12)].map((_, i) => (
            <div
              key={`dup-${i}`}
              className="flex shrink-0 items-center justify-center opacity-[0.06]"
              style={{ animation: `float 4s ease-in-out infinite`, animationDelay: `${(i + 6) * 0.3}s` }}
            >
              <LayoutDashboard className="w-14 h-14 sm:w-20 sm:h-20 text-brand-600" strokeWidth={1.5} />
            </div>
          ))}
        </div>
      </div>

      {/* Layer 3: Vertical flowing gradient stripes for extra depth */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div
          className="absolute w-[200%] h-full animate-marquee-vertical"
          style={{
            background: `repeating-linear-gradient(
              105deg,
              transparent 0px,
              transparent 80px,
              rgba(13, 148, 136, 0.03) 80px,
              rgba(13, 148, 136, 0.03) 85px
            )`,
          }}
        />
      </div>
    </div>
  );
}
