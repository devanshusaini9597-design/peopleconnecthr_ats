export function HomePageStyles() {
  return (
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 9s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 26s linear infinite; }
        .marquee-track:hover .animate-marquee { animation-play-state: paused; }

        @keyframes shine {
          0% { transform: translateX(-150%) skewX(-20deg); }
          100% { transform: translateX(250%) skewX(-20deg); }
        }
        .shine-sweep { position: relative; overflow: hidden; }
        .shine-sweep::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 25%; height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: shine 5s ease-in-out infinite;
          animation-delay: 1.5s;
          pointer-events: none;
        }

        @keyframes rotate-border {
          100% { transform: rotate(360deg); }
        }
        .gradient-border-wrap {
          position: relative;
          border-radius: 1.5rem;
          padding: 2px;
          isolation: isolate;
        }
        .gradient-border-wrap::before {
          content: '';
          position: absolute;
          inset: -60%;
          z-index: 0;
          background: conic-gradient(from 0deg, transparent 0%, #14b8a6 20%, #0d9488 40%, #0f766e 55%, transparent 70%);
          animation: rotate-border 5s linear infinite;
        }
        .gradient-border-inner {
          position: relative;
          z-index: 1;
          border-radius: calc(1.5rem - 2px);
          background: #fff;
          overflow: hidden;
        }

        @keyframes aurora {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-aurora {
          background-size: 200% 200%;
          animation: aurora 8s ease-in-out infinite;
        }

        @keyframes floaty {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-floaty { animation: floaty 5s ease-in-out infinite; }

        @keyframes pulse-ring {
          0% { transform: scale(0.92); opacity: 0.55; }
          70% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .pulse-ring::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: inherit;
          border: 1.5px solid rgba(13, 148, 136, 0.45);
          animation: pulse-ring 2.4s ease-out infinite;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-blob, .animate-marquee, .shine-sweep::before,
          .gradient-border-wrap::before, .animate-aurora, .animate-floaty,
          .pulse-ring::after { animation: none; }
        }
      `}</style>
  );
}
