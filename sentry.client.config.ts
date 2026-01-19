// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Session Replay
  // Capture 10% of sessions for replay
  replaysSessionSampleRate: 0.1,
  // Capture 100% of sessions with errors
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Debug mode (only in development)
  debug: false,

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors that are expected
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // User aborted requests
    "AbortError",
    // Hydration errors (common in Next.js, usually harmless)
    "Hydration failed",
    "There was an error while hydrating",
  ],
});
