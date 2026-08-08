'use client';

import { useEffect, useState } from 'react';
import { Preloader } from '@/components/ui/Preloader';

const PRELOADER_KEY = 'ats-preloader-seen';
const PRELOADER_DURATION_MS = 1500;

export function GlobalPreloaderWrapper({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = sessionStorage.getItem(PRELOADER_KEY);
    if (seen === '1') {
      setShow(false);
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.setItem(PRELOADER_KEY, '1');
      setShow(false);
    }, PRELOADER_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  // Prevent body scroll and flash when preloader is active
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [show]);

  return (
    <>
      {show && <Preloader minDuration={PRELOADER_DURATION_MS} />}
      {/* Main content - hidden during preloader to prevent flash */}
      <div className={show ? 'invisible' : ''} aria-hidden={show}>
        {children}
      </div>
    </>
  );
}
