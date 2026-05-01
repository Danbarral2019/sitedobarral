/**
 * Scrape + Index automático para atos normativos
 *
 * Encapsula: scrapeUrl → salva content → gera embeddings
 * Reutilizado por crons, admin API e import CSV
 */

import { prisma } from '@/lib/prisma';
import { scrapeUrl } from '@/lib/legislative-scrapers';
import { processLegislativeAct } from '@/lib/embeddings/legislative-act-processor';
import { validateActContent } from '@/lib/legislative-scrapers/validate-content';

export interface ScrapeAndIndexResult {
  scraped: boolean;
  indexed: boolean;
  error?: string;
  /** Warnings da validação de formatação. Não bloqueiam mas vão pro log. */
  warnings?: string[];
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

  // 1.5. Validar formatação ANTES de salvar — evita poluir DB com mojibake,
  // FAQ-no-lugar-do-ato, NBSP/zero-width residuais. Errors bloqueiam,
  // warnings são logadas mas não bloqueiam.
  const validation = validateActContent({
    url: act.officialUrl,
    content: result.content,
    previousContent: act.content,
  });
  if (!validation.ok) {
    const errMsg = `Validação falhou: ${validation.errors.join('; ')}`;
    console.error(`[ScrapeAndIndex] ${act.fullNumber}: ${errMsg}`);
    await prisma.legislativeAct.update({
      where: { id: actId },
      data: {
        scrapeStatus: 'failed',
        scrapeError: errMsg.slice(0, 500),
        lastScrapedAt: new Date(),
      },
    });
    return { scraped: false, indexed: false, error: errMsg };
  }
  if (validation.warnings.length > 0) {
    console.warn(
      `[ScrapeAndIndex] ${act.fullNumber} — ${validation.warnings.length} warning(s):`,
      validation.warnings,
    );
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

  return { scraped: true, indexed, warnings: validation.warnings };
}
