import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { scrapeUrl, canScrapeUrl } from '@/lib/legislative-scrapers';
import { hasHashChanged, generateChangeSummary } from '@/lib/legislative-scrapers/change-detector';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

/**
 * POST /api/admin/legislative-acts/[id]/update-content
 *
 * Verifica e atualiza o conteúdo de um ato normativo a partir de sua URL oficial.
 * - Faz scraping da URL oficial
 * - Compara com o conteúdo atual usando hash MD5
 * - Atualiza o registro se houver mudanças
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Verificar autenticação admin
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado - requer privilégios de administrador' },
        { status: 403 }
      );
    }

    // Resolver params
    const resolvedParams = await Promise.resolve(context.params);
    const { id } = resolvedParams;

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
      return NextResponse.json(
        { error: 'Ato normativo não encontrado' },
        { status: 404 }
      );
    }

    if (!act.officialUrl) {
      return NextResponse.json(
        { error: 'Ato não possui URL oficial configurada' },
        { status: 400 }
      );
    }

    // Verificar se temos um scraper para esta URL
    if (!canScrapeUrl(act.officialUrl)) {
      return NextResponse.json(
        {
          error: 'URL não suportada',
          message: 'Não há scraper disponível para esta URL. URLs suportadas: planalto.gov.br, gov.br/compras, in.gov.br',
        },
        { status: 400 }
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

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: 'Falha ao extrair conteúdo da URL oficial',
        },
        { status: 500 }
      );
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

    return NextResponse.json({
      success: true,
      changed,
      message: changed
        ? 'Conteúdo atualizado com sucesso'
        : 'Conteúdo verificado - sem alterações detectadas',
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
  } catch (error) {
    console.error('[Update Content] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro interno',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/legislative-acts/[id]/update-content
 *
 * Retorna o status de scraping do ato normativo.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Verificar autenticação admin
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Resolver params
    const resolvedParams = await Promise.resolve(context.params);
    const { id } = resolvedParams;

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
      return NextResponse.json(
        { error: 'Ato normativo não encontrado' },
        { status: 404 }
      );
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
  } catch (error) {
    console.error('[Update Content GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    );
  }
}
