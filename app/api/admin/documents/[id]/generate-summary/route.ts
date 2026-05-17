import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { generateDocumentSummary, isSummaryServiceAvailable } from '@/lib/summary-generator';
import { isLiteralSourceCategory } from '@/lib/literal-sources';
import { setLeiArticles } from '@/lib/lei-articles';

/**
 * POST /api/admin/documents/[id]/generate-summary
 * Gera resumo automatizado de um documento usando Claude AI
 */
export const POST = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;

  // Verifica se serviço de IA está disponível
  if (!isSummaryServiceAvailable()) {
    throw new ApiError(
      503,
      'Serviço de IA não configurado. Configure ANTHROPIC_API_KEY no .env.local',
      'SERVICE_UNAVAILABLE'
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
    throw new NotFoundError('Documento');
  }

  // Bloqueio de fontes literais: enunciados (e equivalentes) precisam ser citados
  // na íntegra. Reescrita IA introduz alucinações e foi causa raiz de incidente.
  if (isLiteralSourceCategory(document.category)) {
    throw new ApiError(
      422,
      'Categoria literal — geração de resumo IA bloqueada',
      'LITERAL_SOURCE_BLOCKED',
      {
        detail: `Documentos da categoria "${document.category}" devem ser citados na íntegra. Resumos IA estão desabilitados para preservar a redação oficial.`,
      }
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
    throw new ApiError(500, 'Erro ao gerar resumo. Tente novamente mais tarde.', 'AI_GENERATION_FAILED');
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
        ...setLeiArticles(summaryResult.leiArticles.map(String)),
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
});

/**
 * DELETE /api/admin/documents/[id]/generate-summary
 * Remove resumo gerado automaticamente
 */
export const DELETE = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;

  try {
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
    // P2025 (record to update not found) → NotFoundError
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      throw new NotFoundError('Documento');
    }
    throw error;
  }
});
