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
    console.log('[Aprovação] Iniciando processo de aprovação/rejeição');

    // Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.isValid || authResult.payload?.role !== 'admin') {
      console.error('[Aprovação] Autenticação falhou:', { isValid: authResult.isValid, role: authResult.payload?.role });
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { documentIds, action } = body; // action: 'approve' | 'reject'

    console.log('[Aprovação] Request:', { documentIds: documentIds?.length, action });

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      console.error('[Aprovação] IDs inválidos:', documentIds);
      return NextResponse.json(
        { error: 'IDs de documentos não fornecidos' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      console.error('[Aprovação] Ação inválida:', action);
      return NextResponse.json(
        { error: 'Ação inválida. Use "approve" ou "reject"' },
        { status: 400 }
      );
    }

    // Atualizar documentos
    const isPublic = action === 'approve';

    console.log('[Aprovação] Atualizando documentos no banco...');
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

    console.log(`[Aprovação] ✅ Sucesso: ${result.count} documentos ${action === 'approve' ? 'aprovados' : 'rejeitados'}`);

    return NextResponse.json({
      success: true,
      message: `${result.count} documento(s) ${action === 'approve' ? 'aprovado(s)' : 'rejeitado(s)'} com sucesso`,
      count: result.count,
      action: action,
    });

  } catch (error) {
    console.error('[Aprovação] ❌ Erro fatal:', error);
    console.error('[Aprovação] Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao processar aprovação',
      },
      { status: 500 }
    );
  }
}
