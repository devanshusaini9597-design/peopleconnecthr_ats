import { useEffect, useState } from 'react';
import { shouldAutoStartTour } from '../components/ui/ProductTour';

/** Open/close state + optional first-visit auto-start for ProductTour */
export default function usePageTour(storageKey, { autoStart = true, delay = 450 } = {}) {
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (!autoStart || !storageKey || !shouldAutoStartTour(storageKey)) return undefined;
    const t = setTimeout(() => setTourOpen(true), delay);
    return () => clearTimeout(t);
  }, [storageKey, autoStart, delay]);

  return [tourOpen, setTourOpen];
}
