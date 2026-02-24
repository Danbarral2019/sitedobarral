/**
 * Scrape + Index automático para atos normativos
 *
 * Encapsula: scrapeUrl → salva content → gera embeddings
 * Reutilizado por crons, admin API e import CSV
 */

import { prisma } from '@/lib/prisma';
import { scrapeUrl } from '@/lib/legislative-scrapers';
import { processLegislativeAct } from '@/lib/embeddings/legislative-act-processor';

export interface ScrapeAndIndexResult {
  scraped: boolean;
  indexed: boolean;
  error?: string;
}

export async function scrapeAndIndexAct(actId: string): Promise<ScrapeAndIndexResult> {
  const act = await prisma.legislativeAct.findUnique({
    where: { id: actId },
    select: { id: true, officialUrl: true, content: true, contentHash: true, fullNumber: true },
  });

  if (!act || !act.officialUrl) {
    return { scraped: false, indexed: false };
  }

  // 1. Scrape
  const result = await scrapeUrl(act.officialUrl);

  if (!result.success || !result.content) {
    await prisma.legislativeAct.update({
      where: { id: actId },
      data: {
        scrapeStatus: 'failed',
        scrapeError: result.error || 'Conteúdo vazio',
        lastScrapedAt: new Date(),
      },
    });
    return { scraped: false, indexed: false, error: result.error };
  }

  // 2. Salvar content
  await prisma.legislativeAct.update({
    where: { id: actId },
    data: {
      content: result.content,
      contentHash: result.hash || null,
      scrapeStatus: 'success',
      scrapeError: null,
      lastScrapedAt: new Date(),
    },
  });

  console.log(`[ScrapeAndIndex] Conteúdo salvo para "${act.fullNumber}" (${result.content.length} chars)`);

  // 3. Gerar embeddings
  let indexed = false;
  try {
    const embResult = await processLegislativeAct(actId, { forceReprocess: true });
    indexed = embResult.success;
    if (!indexed) {
      console.warn(`[ScrapeAndIndex] Embedding falhou para "${act.fullNumber}": ${embResult.error}`);
    }
  } catch (error) {
    console.error(`[ScrapeAndIndex] Erro ao indexar "${act.fullNumber}":`, error);
  }

  return { scraped: true, indexed };
}
