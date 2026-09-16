import { useEffect, useState } from 'react';
import { shouldAutoStartTour } from '../components/ui/ProductTour';
import { consumeForcedTour, START_TOUR_EVENT } from '../utils/productTourTrigger';

/** Open/close state + optional first-visit auto-start for ProductTour */
export default function usePageTour(storageKey, { autoStart = true, delay = 450 } = {}) {
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (!autoStart || !storageKey || !shouldAutoStartTour(storageKey)) return undefined;
    const t = setTimeout(() => setTourOpen(true), delay);
    return () => clearTimeout(t);
  }, [storageKey, autoStart, delay]);

  useEffect(() => {
    if (!storageKey) return undefined;

    let forceTimer;
    if (consumeForcedTour(storageKey)) {
      forceTimer = setTimeout(() => setTourOpen(true), Math.max(delay, 500));
    }

    const onStart = (e) => {
      if (e?.detail?.tourKey === storageKey) {
        setTourOpen(true);
      }
    };
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => {
      if (forceTimer) clearTimeout(forceTimer);
      window.removeEventListener(START_TOUR_EVENT, onStart);
    };
  }, [storageKey, delay]);

  return [tourOpen, setTourOpen];
}
