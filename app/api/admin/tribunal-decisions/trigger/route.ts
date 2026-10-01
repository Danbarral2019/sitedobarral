import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, ValidationError } from '@/lib/errors/api-error';

export const maxDuration = 300;

/**
 * POST /api/admin/tribunal-decisions/trigger
 * Executar um scraper manualmente (admin)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Unauthorized');
    }

    const body = await request.json();
    const { scraperCode } = body;

    if (!scraperCode) {
      throw new ValidationError('Campo "scraperCode" é obrigatório');
    }

    // Import dinâmico para evitar bundling em todas as rotas
    const { getScraper } = await import('@/lib/tribunal-scrapers');
    const scraper = getScraper(scraperCode);

    if (!scraper) {
      throw new ValidationError(`Scraper "${scraperCode}" não encontrado`);
    }

    const startTime = Date.now();
    const result = await scraper.scrape({ maxItems: 50 });
    const duration = Date.now() - startTime;

    // O log de saúde é gravado pelo próprio scraper (logScraperHealth). Uma
    // segunda linha aqui mascarava falhas — ver sync-tribunal-decisions.

    return NextResponse.json({
      success: true,
      scraperCode: scraper.code,
      result,
      duration,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
