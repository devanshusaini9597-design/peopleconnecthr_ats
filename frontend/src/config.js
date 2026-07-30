// LOCALHOST: npm run dev uses local backend (http://localhost:5000) so you can test fully on localhost.
// Set VITE_USE_LIVE_BACKEND=true in .env.local to point local frontend at the live Render backend instead.
// LIVE SITE: Production build uses VITE_API_URL or https://skillnix-backend.onrender.com so the deployed app works.
const defaultDev = 'http://localhost:5000';
const defaultProd = 'https://skillnix-backend.onrender.com';
const isDev = import.meta.env.DEV;
const useLiveInDev = import.meta.env.VITE_USE_LIVE_BACKEND === 'true' || import.meta.env.VITE_USE_LIVE_BACKEND === '1';
const API_URL = (
  isDev
    ? (useLiveInDev ? (import.meta.env.VITE_API_URL || defaultProd) : defaultDev)
    : (import.meta.env.VITE_API_URL || defaultProd)
).replace(/\/$/, '');

if (isDev) {
  console.log('🔗 API base:', API_URL, useLiveInDev ? '(live backend)' : '(local backend – start backend with npm start in /backend)');
}

export default API_URL;
export const BASE_API_URL = API_URL;
/** Only true in dev (Vite). Use to show "Local" vs "Live" badge. */
export const IS_DEV = isDev;
/** True when local frontend is pointed at live backend (VITE_USE_LIVE_BACKEND). All data/adds go to live DB. */
export const USING_LIVE_BACKEND = isDev && useLiveInDev;
