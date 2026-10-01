import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { apiLogger } from '@/lib/logger';
import { definirOrcamentoIA } from '@/lib/tribunal-scrapers/classifier';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/cron/sync-tribunal-decisions
 * Cron semanal: executa todos os scrapers de tribunais
 * Schedule: "0 7 * * 1" (segunda-feira 7h UTC = 4h BR)
 *
 * `?somente=<code>[,<code>]` executa só esses scrapers. Scrapers com `agendaPropria`
 * ficam fora da rodada comum e têm entrada própria no vercel.json.
 */
export async function GET(request: NextRequest) {
  console.log('[Sync Tribunal Decisions] Iniciando sincronização...');

  try {
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    // Import dinâmico dos scrapers (evita bundling em todas as rotas)
    const { getAllScrapers } = await import('@/lib/tribunal-scrapers');

    // Decisões que o scoring por palavra-chave deixa pendentes são julgadas por
    // IA até este teto por execução (calibrada em 26/09/2026: 51/53 com o editor).
    definirOrcamentoIA(40);

    const somente = new URL(request.url).searchParams.get('somente');
    const codigos = somente ? somente.split(',').map((c) => c.trim()).filter(Boolean) : null;
    const scrapers = getAllScrapers().filter((s) => (codigos ? codigos.includes(s.code) : !s.agendaPropria));
    if (codigos && scrapers.length !== codigos.length) {
      throw new ValidationError(`Scraper não encontrado em "${somente}"`);
    }
    const results = [];

    for (const scraper of scrapers) {
      if (scraper.disabled) {
        console.log(`[Sync Tribunal Decisions] ${scraper.code} desativado: ${scraper.disabled}`);
        results.push({ scraperCode: scraper.code, skipped: scraper.disabled });
        continue;
      }
      const startTime = Date.now();
      try {
        console.log(`[Sync Tribunal Decisions] Executando scraper: ${scraper.code}`);
        const result = await scraper.scrape({ maxItems: 50 });
        const duration = Date.now() - startTime;

        // O log de saúde é gravado pelo próprio scraper (logScraperHealth), com
        // o status real e a mensagem de erro. Não gravar uma segunda linha
        // aqui: ela saía "success" sempre que itemsError era 0 — inclusive
        // quando a fonte tinha caído — e zerava a contagem de falhas
        // consecutivas do cron tribunal-scraper-health, que nunca alertava.

        console.log(
          `[Sync Tribunal Decisions] ${scraper.code}: found=${result.itemsFound} new=${result.itemsNew} errors=${result.itemsError} (${duration}ms)`
        );
        results.push({ ...result, scraperCode: scraper.code, duration });
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        apiLogger.error({ err: errorMessage }, `[Sync Tribunal Decisions] ${scraper.code} falhou:`);

        await prisma.scraperHealthLog.create({
          data: {
            scraperCode: scraper.code,
            status: 'failure',
            duration,
            errorMessage,
          },
        });

        results.push({ scraperCode: scraper.code, error: errorMessage, duration });
      }
    }

    const totalNew = results.reduce((sum, r) => sum + (('itemsNew' in r ? r.itemsNew : 0) || 0), 0);
    const totalErrors = results.reduce((sum, r) => sum + (('itemsError' in r ? r.itemsError : 0) || 0), 0);

    // Identificar highlights editoriais nas novas decisões
    let highlightsCreated = 0;
    if (totalNew > 0) {
      try {
        const startTime = new Date(Date.now() - 600000); // 10 min atrás (margem de segurança)
        const newDecisions = await prisma.tribunalDecision.findMany({
          where: {
            createdAt: { gte: startTime },
            approvalStatus: 'auto_approved',
            highlights: { none: {} },
          },
          select: { id: true },
        });

        if (newDecisions.length > 0) {
          const { identifyAndAlertTribunalHighlights } = await import('@/lib/tribunal-highlight-analyzer');
          highlightsCreated = await identifyAndAlertTribunalHighlights(newDecisions.map(d => d.id));
          console.log(`[Sync Tribunal Decisions] ${highlightsCreated} highlights editoriais criados`);
        }
      } catch (err) {
        apiLogger.error({ err: err instanceof Error ? err.message : err }, '[Sync Tribunal Decisions] Erro ao analisar highlights:');
      }
    }

    const summary = {
      totalScrapers: scrapers.length,
      totalNew,
      totalErrors,
      highlightsCreated,
    };

    console.log('[Sync Tribunal Decisions] Concluído:', JSON.stringify(summary));

    return NextResponse.json({ success: true, summary, results });
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      Sentry.captureException(error, { tags: { cron: 'sync-tribunal-decisions' } });
    }
    return handleApiError(error);
  }
}
