import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError, ValidationError } from '@/lib/errors/api-error';
import { scrapeUrl, canScrapeUrl } from '@/lib/legislative-scrapers';
import { hasHashChanged, generateChangeSummary } from '@/lib/legislative-scrapers/change-detector';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { validateActContent } from '@/lib/legislative-scrapers/validate-content';

/**
 * POST /api/admin/legislative-acts/[id]/update-content
 *
 * Verifica e atualiza o conteúdo de um ato normativo a partir de sua URL oficial.
 * - Faz scraping da URL oficial
 * - Compara com o conteúdo atual usando hash MD5
 * - Atualiza o registro se houver mudanças
 */
export const POST = withAdminApi<{ id: string }>(async (request, ctx) => {
    const { id } = ctx.params;

    // Buscar o ato normativo
    const act = await prisma.legislativeAct.findUnique({
      where: { id },
      select: {
        id: true,
        fullNumber: true,
        officialUrl: true,
        content: true,
        contentHash: true,
        lastScrapedAt: true,
      },
    });

    if (!act) {
      throw new NotFoundError('Ato normativo');
    }

    if (!act.officialUrl) {
      throw new ValidationError('Ato não possui URL oficial configurada');
    }

    // Verificar se temos um scraper para esta URL
    if (!canScrapeUrl(act.officialUrl)) {
      throw new ValidationError(
        'URL não suportada. Não há scraper disponível para esta URL. URLs suportadas: planalto.gov.br, gov.br/compras, in.gov.br',
      );
    }

    // Executar scraping
    console.log(`[Update Content] Iniciando scraping para ${act.fullNumber}: ${act.officialUrl}`);
    const result = await scrapeUrl(act.officialUrl);

    if (!result.success) {
      // Registrar falha
      await prisma.legislativeAct.update({
        where: { id },
        data: {
          lastScrapedAt: new Date(),
          scrapeStatus: 'failed',
          scrapeError: result.error,
        },
      });

      throw new ApiError(
        502,
        result.error || 'Falha ao extrair conteúdo da URL oficial',
        'SCRAPE_FAILED',
      );
    }

    // Validar formatação do novo content ANTES de comparar hash. Se a
    // extração veio quebrada (mojibake, FAQ no lugar do ato, etc.), abortar
    // pra não substituir o conteúdo bom no banco por lixo.
    let validationWarnings: string[] = [];
    if (result.content) {
      const validation = validateActContent({
        url: act.officialUrl,
        content: result.content,
        previousContent: act.content,
      });
      if (!validation.ok) {
        const errMsg = `Validação falhou: ${validation.errors.join('; ')}`;
        await prisma.legislativeAct.update({
          where: { id },
          data: {
            lastScrapedAt: new Date(),
            scrapeStatus: 'failed',
            scrapeError: errMsg.slice(0, 500),
          },
        });
        throw new ApiError(
          422,
          'Validação de formatação falhou. Scrape executou mas o conteúdo extraído não passou na validação. Conteúdo atual no banco preservado.',
          'VALIDATION_ERROR',
          { details: validation.errors, warnings: validation.warnings },
        );
      }
      validationWarnings = validation.warnings;
    }

    // Verificar se houve mudança
    const changed = hasHashChanged(act.contentHash, result.hash!);

    // Preparar dados de atualização
    const updateData: {
      lastScrapedAt: Date;
      scrapeStatus: string;
      scrapeError: null;
      content?: string;
      contentHash?: string;
      changeDetectedAt?: Date;
    } = {
      lastScrapedAt: new Date(),
      scrapeStatus: changed ? 'success' : 'unchanged',
      scrapeError: null,
    };

    let changeSummary: string | null = null;

    if (changed) {
      updateData.content = result.content;
      updateData.contentHash = result.hash;
      updateData.changeDetectedAt = new Date();

      // Gerar resumo das mudanças se havia conteúdo anterior
      if (act.content) {
        changeSummary = generateChangeSummary(act.content, result.content!);
      }
    }

    // Atualizar no banco
    await prisma.legislativeAct.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Update Content] Concluído para ${act.fullNumber}: ${changed ? 'ALTERADO' : 'sem mudanças'}`);

    // Invalidate cache
    if (changed) {
      CacheInvalidation.legislativeActs().catch(console.error);
    }

    return NextResponse.json({
      success: true,
      changed,
      message: changed
        ? 'Conteúdo atualizado com sucesso'
        : 'Conteúdo verificado - sem alterações detectadas',
      warnings: validationWarnings,
      data: {
        fullNumber: act.fullNumber,
        source: result.source,
        extractedAt: result.extractedAt,
        contentLength: result.content?.length,
        hash: result.hash,
        previousHash: act.contentHash,
        changeSummary,
      },
    });
});

/**
 * GET /api/admin/legislative-acts/[id]/update-content
 *
 * Retorna o status de scraping do ato normativo.
 */
export const GET = withAdminApi<{ id: string }>(async (_request, ctx) => {
    const { id } = ctx.params;

    const act = await prisma.legislativeAct.findUnique({
      where: { id },
      select: {
        id: true,
        fullNumber: true,
        officialUrl: true,
        contentHash: true,
        lastScrapedAt: true,
        scrapeStatus: true,
        scrapeError: true,
        changeDetectedAt: true,
        notifyOnChange: true,
      },
    });

    if (!act) {
      throw new NotFoundError('Ato normativo');
    }

    return NextResponse.json({
      id: act.id,
      fullNumber: act.fullNumber,
      officialUrl: act.officialUrl,
      canScrape: act.officialUrl ? canScrapeUrl(act.officialUrl) : false,
      scraping: {
        lastScrapedAt: act.lastScrapedAt,
        status: act.scrapeStatus,
        error: act.scrapeError,
        changeDetectedAt: act.changeDetectedAt,
        contentHash: act.contentHash,
        notifyOnChange: act.notifyOnChange,
      },
    });
});
