/**
 * API: Aprovar/Rejeitar Documentos
 *
 * Permite que o admin aprove ou rejeite documentos importados automaticamente (DOU, TCU, AGU).
 *
 * Ações:
 * - Aprovar → marca como reviewed=true, isPublic=true (visível para alunos)
 * - Rejeitar → marca como reviewed=true, isPublic=false (oculto)
 * - Aprovar em lote → múltiplos documentos de uma vez
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.isValid || authResult.payload?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { documentIds, action } = body; // action: 'approve' | 'reject'

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'IDs de documentos não fornecidos' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Ação inválida. Use "approve" ou "reject"' },
        { status: 400 }
      );
    }

    // Atualizar documentos
    const isPublic = action === 'approve';

    const result = await prisma.document.updateMany({
      where: {
        id: {
          in: documentIds,
        },
      },
      data: {
        reviewed: true,
        reviewedAt: new Date(),
        isPublic: isPublic,
      },
    });

    console.log(`[Aprovação] ${result.count} documentos ${action === 'approve' ? 'aprovados' : 'rejeitados'}`);

    return NextResponse.json({
      success: true,
      message: `${result.count} documento(s) ${action === 'approve' ? 'aprovado(s)' : 'rejeitado(s)'} com sucesso`,
      count: result.count,
      action: action,
    });

  } catch (error) {
    console.error('[Aprovação] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
