import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Only init when a DSN is configured (production).
// Set VITE_SENTRY_DSN in .env.local (not committed) or in Cloudflare env.
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Capture 10% of sessions as performance samples to stay on free tier.
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

export { Sentry };
