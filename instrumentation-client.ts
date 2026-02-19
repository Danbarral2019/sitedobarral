// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  // Capture 5% of transactions for performance monitoring
  tracesSampleRate: 0.05,

  // No heavy integrations (Session Replay removed to save ~115KB)
  integrations: [],

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

// Required for Sentry to instrument client-side navigations
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
