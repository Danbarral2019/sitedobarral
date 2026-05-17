import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import {
  CacheInvalidation,
  getCacheStats,
  healthCheck,
  isCacheEnabled,
} from '@/lib/cache/redis-client';

/**
 * GET /api/admin/cache
 * Get cache status and statistics
 */
export const GET = withAdminApi(async () => {
  const health = await healthCheck();
  const stats = await getCacheStats();

  return NextResponse.json({
    success: true,
    cache: {
      enabled: isCacheEnabled(),
      connected: health.connected,
      latency: health.latency,
      error: health.error,
      registeredPrefixes: stats.registeredPrefixes,
    },
  });
});

/**
 * POST /api/admin/cache
 * Invalidate cache by target
 *
 * Body: { target: 'faq' | 'testimonials' | 'glossary' | 'legislativeActs' | 'leiArticles' | 'courseDocuments' | 'all' }
 */
export const POST = withAdminApi(async (request, { logger }) => {
  const body = await request.json();
  const { target, courseId } = body;

  if (!target) {
    throw new ValidationError(
      'Target é obrigatório. Use: faq, testimonials, glossary, legislativeActs, leiArticles, courseDocuments, ou all'
    );
  }

  let result: { invalidated: number | { total: number; details: Record<string, number> }; target: string };

  switch (target) {
    case 'faq':
      result = {
        invalidated: await CacheInvalidation.faq(),
        target: 'faq',
      };
      break;

    case 'testimonials':
      await CacheInvalidation.testimonials();
      result = {
        invalidated: 1,
        target: 'testimonials',
      };
      break;

    case 'glossary':
      result = {
        invalidated: await CacheInvalidation.glossary(),
        target: 'glossary',
      };
      break;

    case 'legislativeActs':
      result = {
        invalidated: await CacheInvalidation.legislativeActs(),
        target: 'legislativeActs',
      };
      break;

    case 'leiArticles':
      result = {
        invalidated: await CacheInvalidation.leiArticles(),
        target: 'leiArticles',
      };
      break;

    case 'courseDocuments':
      result = {
        invalidated: await CacheInvalidation.courseDocuments(courseId),
        target: courseId ? `courseDocuments:${courseId}` : 'courseDocuments:all',
      };
      break;

    case 'all': {
      const allResult = await CacheInvalidation.all();
      result = {
        invalidated: allResult,
        target: 'all',
      };
      break;
    }

    default:
      throw new ValidationError(
        `Target inválido: ${target}. Use: faq, testimonials, glossary, legislativeActs, leiArticles, courseDocuments, ou all`
      );
  }

  logger.info({ target, result }, 'Cache invalidated');

  return NextResponse.json({
    success: true,
    message: `Cache invalidado com sucesso para: ${result.target}`,
    ...result,
  });
});
