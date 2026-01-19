// This file configures the initialization of Sentry for edge features (Middleware, Edge API routes).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Debug mode (only in development)
  debug: false,
});
