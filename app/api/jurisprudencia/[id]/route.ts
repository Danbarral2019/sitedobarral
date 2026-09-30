import { NextRequest, NextResponse } from 'next/server';
import { fetchUnifiedById } from '@/lib/jurisprudencia/unified-query';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAcessoDoUsuario, podeVerDocumento } from '@/lib/search/acesso-documentos';

/**
 * GET /api/jurisprudencia/[id]
 * Detalhes de uma decisão — aceita IDs de TribunalDecision e de Document TCU.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const decision = await fetchUnifiedById(id);

    if (!decision) {
      throw new NotFoundError('Decisão não encontrada');
    }

    // Acórdão do acervo (Document): o inteiro teor e o resumo só vão para
    // quem pode ver o documento. O endereço continua respondendo (o sitemap
    // o publica), com a ementa e sem o conteúdo integral.
    if (decision.sourceType === 'document-tcu') {
      const [doc, authResult] = await Promise.all([
        prisma.document.findUnique({
          where: { id },
          select: { isPublic: true, isCommon: true, courseId: true, category: true },
        }),
        verifyAuth(request),
      ]);
      const acesso = await getAcessoDoUsuario(authResult.valid ? authResult.user : null);
      if (!doc || !podeVerDocumento(doc, acesso)) {
        return NextResponse.json({
          ...decision,
          fullText: null,
          summary: null,
          acessoRestrito: true,
        });
      }
    }

    return NextResponse.json(decision);
  } catch (error) {
    return handleApiError(error);
  }
}
