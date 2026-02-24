import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeUrl, canScrapeUrl } from '@/lib/legislative-scrapers';
import { hasHashChanged } from '@/lib/legislative-scrapers/change-detector';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';
import { verifyCronAuth } from '@/lib/cron-auth';

/**
 * GET /api/cron/check-legislative-updates
 *
 * Cron job para verificar automaticamente atualizações em atos normativos.
 * - Processa até 10 atos por execução
 * - Verifica apenas atos não checados há 7+ dias
 * - Adiciona delay de 2s entre requisições para evitar rate limiting
 *
 * Configurar no Vercel Cron ou outro serviço:
 * Schedule: 0 3 * * 1 (toda segunda-feira às 3h)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação via CRON_SECRET
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    console.log('[Cron Legislative] Iniciando verificação de atualizações...');

    // Buscar atos que não foram verificados há 7+ dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const actsToCheck = await prisma.legislativeAct.findMany({
      where: {
        officialUrl: { not: null },
        OR: [
          { lastScrapedAt: null },
          { lastScrapedAt: { lt: sevenDaysAgo } },
        ],
      },
      select: {
        id: true,
        fullNumber: true,
        officialUrl: true,
        content: true,
        contentHash: true,
      },
      take: 10, // Limitar a 10 por execução
      orderBy: [
        { lastScrapedAt: 'asc' }, // Mais antigos primeiro
      ],
    });

    console.log(`[Cron Legislative] ${actsToCheck.length} atos para verificar`);

    const results: {
      id: string;
      fullNumber: string;
      status: 'success' | 'unchanged' | 'failed' | 'skipped';
      changed?: boolean;
      error?: string;
    }[] = [];

    for (const act of actsToCheck) {
      // Verificar se temos scraper para esta URL
      if (!act.officialUrl || !canScrapeUrl(act.officialUrl)) {
        results.push({
          id: act.id,
          fullNumber: act.fullNumber,
          status: 'skipped',
          error: 'URL não suportada',
        });
        continue;
      }

      console.log(`[Cron Legislative] Verificando: ${act.fullNumber}`);

      try {
        // Fazer scraping
        const result = await scrapeUrl(act.officialUrl);

        if (!result.success) {
          // Registrar falha
          await prisma.legislativeAct.update({
            where: { id: act.id },
            data: {
              lastScrapedAt: new Date(),
              scrapeStatus: 'failed',
              scrapeError: result.error,
            },
          });

          results.push({
            id: act.id,
            fullNumber: act.fullNumber,
            status: 'failed',
            error: result.error,
          });
        } else {
          // Verificar se houve mudança
          const changed = hasHashChanged(act.contentHash, result.hash!);

          // Atualizar registro
          await prisma.legislativeAct.update({
            where: { id: act.id },
            data: {
              lastScrapedAt: new Date(),
              scrapeStatus: changed ? 'success' : 'unchanged',
              scrapeError: null,
              ...(changed && {
                content: result.content,
                contentHash: result.hash,
                changeDetectedAt: new Date(),
              }),
            },
          });

          results.push({
            id: act.id,
            fullNumber: act.fullNumber,
            status: changed ? 'success' : 'unchanged',
            changed,
          });
        }
      } catch (error) {
        console.error(`[Cron Legislative] Erro em ${act.fullNumber}:`, error);
        results.push({
          id: act.id,
          fullNumber: act.fullNumber,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }

      // Delay de 2s entre requisições para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Segunda passagem: preencher backlog de atos COM officialUrl mas SEM content
    const backlogActs = await prisma.legislativeAct.findMany({
      where: {
        officialUrl: { not: null },
        content: null,
        // Excluir atos já processados nesta execução
        id: { notIn: actsToCheck.map(a => a.id) },
      },
      select: { id: true, fullNumber: true },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    const backlogResults: { id: string; fullNumber: string; scraped: boolean; indexed: boolean; error?: string }[] = [];

    if (backlogActs.length > 0) {
      console.log(`[Cron Legislative] Preenchendo backlog: ${backlogActs.length} atos sem conteúdo`);

      for (const act of backlogActs) {
        try {
          const res = await scrapeAndIndexAct(act.id);
          backlogResults.push({ id: act.id, fullNumber: act.fullNumber, ...res });
        } catch (error) {
          backlogResults.push({
            id: act.id,
            fullNumber: act.fullNumber,
            scraped: false,
            indexed: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Estatísticas
    const stats = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      unchanged: results.filter(r => r.status === 'unchanged').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      changed: results.filter(r => r.changed).length,
      backlog: {
        total: backlogResults.length,
        scraped: backlogResults.filter(r => r.scraped).length,
        indexed: backlogResults.filter(r => r.indexed).length,
      },
    };

    console.log('[Cron Legislative] Concluído:', stats);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      results,
      backlogResults,
    });
  } catch (error) {
    console.error('[Cron Legislative] Erro geral:', error);
    return NextResponse.json(
      {
        error: 'Erro ao processar verificação',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/check-legislative-updates
 *
 * Endpoint alternativo para trigger manual ou via webhook.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
