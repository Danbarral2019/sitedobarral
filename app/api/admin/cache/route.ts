import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api-middleware';
import {
  CacheInvalidation,
  getCacheStats,
  healthCheck,
  isCacheEnabled,
} from '@/lib/cache/redis-client';
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/cache
 * Get cache status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

    // Get health check
    const health = await healthCheck();

    // Get cache stats
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
  } catch (error) {
    apiLogger.error({ err: error }, 'Error getting cache status:');
    return NextResponse.json(
      { error: 'Erro ao verificar status do cache' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cache
 * Invalidate cache by target
 *
 * Body: { target: 'faq' | 'testimonials' | 'glossary' | 'legislativeActs' | 'leiArticles' | 'courseDocuments' | 'all' }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

    const body = await request.json();
    const { target, courseId } = body;

    if (!target) {
      return NextResponse.json(
        { error: 'Target é obrigatório. Use: faq, testimonials, glossary, legislativeActs, leiArticles, courseDocuments, ou all' },
        { status: 400 }
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

      case 'all':
        const allResult = await CacheInvalidation.all();
        result = {
          invalidated: allResult,
          target: 'all',
        };
        break;

      default:
        return NextResponse.json(
          { error: `Target inválido: ${target}. Use: faq, testimonials, glossary, legislativeActs, leiArticles, courseDocuments, ou all` },
          { status: 400 }
        );
    }

    console.log(`[Admin Cache] Invalidated cache for target: ${target}`, result);

    return NextResponse.json({
      success: true,
      message: `Cache invalidado com sucesso para: ${result.target}`,
      ...result,
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Error invalidating cache:');
    return NextResponse.json(
      { error: 'Erro ao invalidar cache' },
      { status: 500 }
    );
  }
}
