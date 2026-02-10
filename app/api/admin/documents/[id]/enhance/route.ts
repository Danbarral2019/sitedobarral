import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enhanceDocumentWithAI } from '@/lib/ai/document-enhancer';

/**
 * POST /api/admin/documents/[id]/enhance
 *
 * Enriquece documento com IA (Claude Sonnet):
 * - Resumo executivo
 * - Destaques principais
 * - Pontos-chave para alunos
 * - Aplicação prática
 * - Observações educacionais do professor
 * - Sugestão de importância
 * - Tags
 * - Artigos da Lei 14.133/2021 relacionados
 *
 * Retorna sugestões SEM salvar automaticamente (admin revisa e aceita)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    // 1. Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Buscar documento
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        url: true,
        summary: true,
        content: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    console.log(`[Enhance] Enriquecendo documento: ${document.title}`);

    // 3. Chamar IA para enriquecer
    const enhancement = await enhanceDocumentWithAI({
      title: document.title,
      description: document.description || undefined,
      category: document.category,
      url: document.url || undefined,
      summary: document.summary || undefined,
      content: document.content || undefined,
    });

    console.log(`[Enhance] Sucesso! Confiança: ${enhancement.confidence}%`);
    console.log(`[Enhance] Artigos sugeridos: ${enhancement.leiArticles.join(', ')}`);

    // 4. Retornar sugestões (não salvar automaticamente)
    return NextResponse.json({
      success: true,
      enhancement: {
        summary: enhancement.summary,
        highlights: enhancement.highlights,
        keyPoints: enhancement.keyPoints.join('\n'), // Converter array para string (1 por linha)
        practicalUse: enhancement.practicalUse,
        publicNotes: enhancement.publicNotes,
        suggestedImportance: enhancement.suggestedImportance,
        tags: enhancement.tags,
        leiArticles: enhancement.leiArticles,
        confidence: enhancement.confidence,
        reasoning: enhancement.reasoning,
      },
    });
  } catch (error) {
    console.error('[Enhance] Erro ao enriquecer documento:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Erro ao enriquecer documento com IA',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Erro desconhecido ao enriquecer documento' },
      { status: 500 }
    );
  }
}
