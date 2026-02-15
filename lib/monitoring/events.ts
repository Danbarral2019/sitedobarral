/**
 * Server-side event tracking via Sentry breadcrumbs.
 *
 * Breadcrumbs are attached to the current Sentry scope and will appear
 * in any error report that happens later in the same request.
 * Safe to call even when Sentry DSN is not configured.
 */

export function trackServerEvent(
  name: string,
  data?: Record<string, unknown>
): void {
  try {
    // Dynamic import so the module never throws at parse time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nextjs');
    Sentry.addBreadcrumb({
      category: 'app.event',
      message: name,
      data,
      level: 'info',
    });
  } catch {
    // Sentry not available — silently ignore
  }
}
