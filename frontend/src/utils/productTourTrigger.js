/**
 * Cross-page tour launcher used by What's New "Take a tour" actions.
 * Stores a forced tour key, then pages listen and open ProductTour.
 */

export const FORCE_TOUR_STORAGE_KEY = 'skillnix_force_tour';
export const START_TOUR_EVENT = 'skillnix:start-tour';

export function requestProductTour(tourKey) {
  if (!tourKey) return;
  try {
    sessionStorage.setItem(FORCE_TOUR_STORAGE_KEY, tourKey);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(START_TOUR_EVENT, { detail: { tourKey } }));
  } catch {
    /* ignore */
  }
}

export function consumeForcedTour(tourKey) {
  if (!tourKey) return false;
  try {
    const stored = sessionStorage.getItem(FORCE_TOUR_STORAGE_KEY);
    if (stored === tourKey) {
      sessionStorage.removeItem(FORCE_TOUR_STORAGE_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
