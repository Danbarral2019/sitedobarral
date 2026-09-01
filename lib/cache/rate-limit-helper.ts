/**
 * Redis-based rate limiting helper
 *
 * Replaces in-memory rate limiting (lib/rate-limit.ts) with
 * Redis-backed rate limiting that works across serverless instances.
 *
 * Usage:
 *   import { enforceRateLimit } from '@/lib/cache/rate-limit-helper';
 *
 *   // In route handler:
 *   const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
 *   await enforceRateLimit(`auth:login:${ip}`, 5, 60);
 */

import { checkRateLimit, type FailureMode } from './redis-client';
import { RateLimitError } from '@/lib/errors/api-error';

/**
 * Enforce rate limit — throws RateLimitError if exceeded.
 *
 * Drop-in replacement for `rateLimiters.xxx.check(request, limit)`.
 * Works across serverless instances via Upstash Redis.
 *
 * @param identifier - Unique key, e.g. `auth:login:${ip}`
 * @param limit - Max requests allowed in the window
 * @param windowSeconds - Time window in seconds (default 60)
 * @throws RateLimitError if rate limit exceeded
 */
export async function enforceRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number = 60,
  options: { failureMode?: FailureMode } = {},
): Promise<void> {
  const result = await checkRateLimit(identifier, limit, windowSeconds, options);
  if (!result.allowed) {
    throw new RateLimitError(
      'Muitas tentativas. Tente novamente em breve.',
      windowSeconds
    );
  }
}

/**
 * Extract IP address from request headers
 * Handles x-forwarded-for (multiple proxies) and x-real-ip
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
