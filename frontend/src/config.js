// LOCALHOST: npm run dev uses local backend (http://localhost:5000).
// Set VITE_USE_LIVE_BACKEND=true in .env.local to point at the live backend.
const defaultDev = 'http://localhost:5000';
const isDev = import.meta.env.DEV;
const useLiveInDev = import.meta.env.VITE_USE_LIVE_BACKEND === 'true' || import.meta.env.VITE_USE_LIVE_BACKEND === '1';

const configured = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
if (!isDev && !configured) {
  console.error('⚠️ VITE_API_URL not set in production build!');
}

const API_URL = (
  isDev
    ? (useLiveInDev ? (configured || defaultDev) : defaultDev)
    : (configured || defaultDev)
).replace(/\/$/, '');

if (isDev) {
  console.log('🔗 API base:', API_URL, useLiveInDev ? '(live backend)' : '(local backend – start backend with npm start in /backend)');
}

export default API_URL;
export const BASE_API_URL = API_URL;
/** Only true in dev (Vite). Use to show "Local" vs "Live" badge. */
export const IS_DEV = isDev;
/** True when local frontend is pointed at live backend (VITE_USE_LIVE_BACKEND). */
export const USING_LIVE_BACKEND = isDev && useLiveInDev;
