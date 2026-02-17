import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeNewInformativos } from '@/lib/tcu-informativo-scraper';
import { verifyCronAuth } from '@/lib/cron-auth';

/**
 * Cron Job: Sincronização automática de Informativos de Jurisprudência Selecionada do TCU
 *
 * Pipeline:
 * 1. Scrape informativos recentes via API BFF / Portal TCU
 * 2. Deduplicação contra banco existente (por título normalizado)
 * 3. Inserção de novos informativos como Document (category: 'informativo')
 * 4. Marca embeddings como 'pending' para indexação pelo cron de process-index-jobs
 *
 * Segurança: Requer CRON_SECRET ou Authorization header
 * Agendamento: Toda segunda-feira às 5h UTC (vercel.json)
 */

// Permitir até 300s para scraping + inserção
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    // 1. Verificação de segurança
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    console.log('[Sync TCU Info] Iniciando sincronização de informativos...');
    const startTime = Date.now();

    // 2. Scrape informativos do TCU
    const scrapeResult = await scrapeNewInformativos({ limit: 50 });

    if (scrapeResult.error && scrapeResult.newItems.length === 0) {
      console.log(`[Sync TCU Info] Scraping falhou: ${scrapeResult.error}`);
      return NextResponse.json({
        message: `Scraping falhou: ${scrapeResult.error}`,
        success: false,
        source: scrapeResult.source,
        error: scrapeResult.error,
        totalScraped: 0,
        newFound: 0,
        imported: 0,
        duplicates: 0,
      });
    }

    console.log(`[Sync TCU Info] ${scrapeResult.totalScraped} scrapeados, ${scrapeResult.newItems.length} novos, ${scrapeResult.duplicates} duplicados`);

    // 3. Importar novos informativos
    let imported = 0;
    let errors = 0;
    const newDocIds: string[] = [];

    for (const item of scrapeResult.newItems) {
      try {
        const tags = ['TCU', 'Informativo', 'Jurisprudência Selecionada'];
        if (item.numero) {
          tags.push(item.numero);
        }

        const created = await prisma.document.create({
          data: {
            title: item.titulo,
            description: item.enunciado || item.titulo,
            content: item.enunciado || null,
            url: item.url || item.linkPdf || '',
            type: 'link',
            category: 'informativo',
            courseId: null,
            isCommon: true,
            isPublic: true,
            reviewed: true,
            reviewedAt: new Date(),
            reviewedBy: 'auto-sync-tcu-informativos',
            tags: JSON.stringify(tags),
            // Dual-write: flat fields (transition) + satellite table
            tcuLinkPDF: item.linkPdf || null,
            tcuDataJulgamento: item.dataPublicacao || null,
            tcuEnriquecidoEm: new Date(),
            tcuEnriquecimentoStatus: 'success',
            embeddingStatus: 'pending',
            metaTcu: {
              create: {
                linkPDF: item.linkPdf || null,
                dataJulgamento: item.dataPublicacao || null,
                enriquecidoEm: new Date(),
                enriquecimentoStatus: 'success',
              },
            },
          },
        });

        newDocIds.push(created.id);
        imported++;
        console.log(`[Sync TCU Info] Importado: ${item.titulo}`);
      } catch (err) {
        errors++;
        console.error(
          `[Sync TCU Info] Erro ao importar "${item.titulo}":`,
          err instanceof Error ? err.message : err
        );
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const result = {
      success: true,
      source: scrapeResult.source,
      totalScraped: scrapeResult.totalScraped,
      duplicates: scrapeResult.duplicates,
      newFound: scrapeResult.newItems.length,
      imported,
      errors,
      newDocIds,
      elapsed: `${elapsed}s`,
    };

    console.log('[Sync TCU Info] Resultado:', result);

    return NextResponse.json({
      message: `Sincronização Informativos TCU: ${imported} importados de ${scrapeResult.totalScraped} scrapeados`,
      ...result,
    });
  } catch (error) {
    console.error('[Sync TCU Info] Erro fatal:', error);
    return NextResponse.json(
      {
        error: 'Erro ao sincronizar informativos do TCU',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
