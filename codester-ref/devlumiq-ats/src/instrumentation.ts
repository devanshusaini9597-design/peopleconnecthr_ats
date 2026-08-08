/**
 * Next.js Instrumentation — loaded once at server startup.
 * Initialises Sentry only when SENTRY_DSN is set.
 * Leave the env var empty (or unset) to disable Sentry entirely.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // @ts-ignore — optional dependency: npm i @sentry/nextjs to enable
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'production',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: false,
    });
    console.log('[Sentry] Initialised');
  } catch {
    console.warn('[Sentry] @sentry/nextjs not installed — skipping. Run: npm i @sentry/nextjs');
  }
}
