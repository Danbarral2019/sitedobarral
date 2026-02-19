import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';

/**
 * GET /api/jurisprudencia/[id]
 * Detalhes de uma decisão de tribunal (pública, apenas aprovadas)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const decision = await prisma.tribunalDecision.findUnique({
      where: { id },
      select: {
        id: true,
        tribunalCode: true,
        tribunalName: true,
        decisionType: true,
        decisionNumber: true,
        processNumber: true,
        year: true,
        fullIdentifier: true,
        title: true,
        ementa: true,
        fullText: true,
        summary: true,
        relator: true,
        orgaoJulgador: true,
        dataJulgamento: true,
        dataPublicacao: true,
        url: true,
        pdfUrl: true,
        isRelevant: true,
        relevanceScore: true,
        themes: true,
        leiArticles: true,
        suggestedCourses: true,
        approvalStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!decision) {
      throw new NotFoundError('Decisão não encontrada');
    }

    // Bloquear acesso a decisões não aprovadas na API pública
    const approved = ['auto_approved', 'manually_approved'];
    if (!approved.includes(decision.approvalStatus) || !decision.isRelevant) {
      throw new NotFoundError('Decisão não encontrada');
    }

    return NextResponse.json(decision);
  } catch (error) {
    return handleApiError(error);
  }
}
