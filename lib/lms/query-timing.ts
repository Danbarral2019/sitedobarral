import * as Sentry from '@sentry/nextjs';
import { apiLogger } from '@/lib/logger';

const SLOW_THRESHOLD_MS = 500;

/**
 * Envolve uma query/operação LMS com instrumentação:
 * - Mede duração via `performance.now()`
 * - Loga via `apiLogger.info({ lms_query, ms_total }, 'lms.query')`
 * - Envia breadcrumb Sentry quando `ms > 500`
 * - Re-throw do erro original em falha (não altera error path)
 */
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - start);
    apiLogger.info({ lms_query: label, ms_total: ms }, 'lms.query');
    if (ms > SLOW_THRESHOLD_MS) {
      Sentry.addBreadcrumb({
        category: 'lms.slow',
        level: 'warning',
        message: label,
        data: { ms },
      });
    }
    return result;
  } catch (err) {
    apiLogger.error({ lms_query: label, err }, 'lms.query.failed');
    throw err;
  }
}
