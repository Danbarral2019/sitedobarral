import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';
import { generateDocumentSummary, isSummaryServiceAvailable } from '@/lib/summary-generator';
import { isLiteralSourceCategory } from '@/lib/literal-sources';
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/admin/documents/[id]/generate-summary
 * Gera resumo automatizado de um documento usando Claude AI
 */
export const POST = withAdminAuth(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const { id } = params;

    // Verifica se serviço de IA está disponível
    if (!isSummaryServiceAvailable()) {
      return NextResponse.json(
        { error: 'Serviço de IA não configurado. Configure ANTHROPIC_API_KEY no .env.local' },
        { status: 503 }
      );
    }

    // Busca documento
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        summary: true,
        summaryGeneratedAt: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // Bloqueio de fontes literais: enunciados (e equivalentes) precisam ser citados
    // na íntegra. Reescrita IA introduz alucinações e foi causa raiz de incidente.
    if (isLiteralSourceCategory(document.category)) {
      return NextResponse.json(
        {
          error: 'Categoria literal — geração de resumo IA bloqueada',
          detail: `Documentos da categoria "${document.category}" devem ser citados na íntegra. Resumos IA estão desabilitados para preservar a redação oficial.`,
        },
        { status: 422 }
      );
    }

    // Gera resumo com Claude
    console.log(`[Generate Summary] Gerando resumo para documento: ${document.title}`);

    const summaryResult = await generateDocumentSummary(
      document.title,
      document.description || undefined,
      undefined, // fullText - TODO: extrair de PDF se necessário
      document.category
    );

    if (!summaryResult) {
      return NextResponse.json(
        { error: 'Erro ao gerar resumo. Tente novamente mais tarde.' },
        { status: 500 }
      );
    }

    // Salva resumo no banco. Sempre reseta a flag de revisão — resumo novo
    // (mesmo regerado) precisa de aprovação humana antes do badge sumir.
    const updated = await prisma.document.update({
      where: { id },
      data: {
        summary: summaryResult.summary,
        summaryHighlights: JSON.stringify(summaryResult.highlights),
        summaryGeneratedAt: new Date(),
        summaryEditedByAdmin: false,
        summaryReviewedByAdmin: false,
        summaryReviewedAt: null,
        summaryReviewedBy: null,
        // Atualiza tags e artigos se confiança for alta
        ...(summaryResult.confidence >= 70 && {
          tags: summaryResult.tags.join(', '),
          leiArticles: JSON.stringify(summaryResult.leiArticles),
        }),
      },
    });

    console.log(`[Generate Summary] Resumo salvo com sucesso. Confiança: ${summaryResult.confidence}%`);

    return NextResponse.json({
      success: true,
      summary: {
        ...summaryResult,
        generatedAt: updated.summaryGeneratedAt,
      },
      document: {
        id: updated.id,
        title: updated.title,
        summary: updated.summary,
      },
    });

  } catch (error) {
    apiLogger.error({ err: error }, '[Generate Summary] Erro:');
    return NextResponse.json(
      { error: 'Erro ao gerar resumo do documento' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/documents/[id]/generate-summary
 * Remove resumo gerado automaticamente
 */
export const DELETE = withAdminAuth(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const { id } = params;

    // Atualiza documento removendo resumo
    const updated = await prisma.document.update({
      where: { id },
      data: {
        summary: null,
        summaryHighlights: null,
        summaryGeneratedAt: null,
        summaryEditedByAdmin: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Resumo removido com sucesso',
      document: {
        id: updated.id,
        title: updated.title,
      },
    });

  } catch (error) {
    apiLogger.error({ err: error }, '[Delete Summary] Erro:');

    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao remover resumo' },
      { status: 500 }
    );
  }
});
