/**
 * Client-side event tracking via Vercel Analytics.
 *
 * Uses the `track()` function from @vercel/analytics.
 * Safe to call even when analytics is not configured.
 */

export function trackClientEvent(
  name: string,
  data?: Record<string, string | number | boolean | null>
): void {
  try {
    // Dynamic import to keep the module tree-shakeable
    import('@vercel/analytics').then(({ track }) => {
      track(name, data ?? {});
    });
  } catch {
    // Analytics not available — silently ignore
  }
}
