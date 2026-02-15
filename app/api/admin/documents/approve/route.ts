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
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function POST(request: NextRequest) {
  try {
    console.log('[Aprovação] Iniciando processo de aprovação/rejeição');

    // Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      console.error('[Aprovação] Autenticação falhou:', { valid: authResult.valid, role: authResult.user?.role });
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // ✅ FIX #5: Capturar email do admin para audit trail
    const adminEmail = authResult.user?.email || 'unknown';
    console.log('[Aprovação] Admin:', adminEmail);

    const body = await request.json();
    const { documentIds, action } = body; // action: 'approve' | 'reject'

    console.log('[Aprovação] Request:', { documentIds: documentIds?.length, action, adminEmail });

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

    // ✅ FIX #5: Usar transação para garantir atomicidade (approve + audit log)
    const isPublic = action === 'approve';
    const now = new Date();

    console.log('[Aprovação] Iniciando transação atômica...');

    // Transação: UPDATE documents + CREATE audit logs
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buscar documentos pendentes que serão atualizados (optimistic locking)
      const documentsToUpdate = await tx.document.findMany({
        where: {
          id: { in: documentIds },
          reviewed: false, // ✅ Optimistic locking - só processa se ainda não revisado
        },
        select: {
          id: true,
          title: true,
          courseId: true,
        },
      });

      if (documentsToUpdate.length === 0) {
        // Todos já foram processados
        return { count: 0, documents: [] };
      }

      const idsToUpdate = documentsToUpdate.map(d => d.id);

      // 2. Atualizar documentos atomicamente
      await tx.document.updateMany({
        where: {
          id: { in: idsToUpdate },
        },
        data: {
          reviewed: true,
          reviewedAt: now,
          reviewedBy: adminEmail, // ✅ FIX #5: Registrar quem aprovou
          isPublic: isPublic,
        },
      });

      // 3. Criar logs de auditoria para cada documento
      const accessLogs = documentsToUpdate.map(doc => ({
        userId: adminEmail,
        documentId: doc.id,
        courseId: doc.courseId,
        action: action === 'approve' ? 'document_approved' : 'document_rejected',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        createdAt: now,
      }));

      await tx.accessLog.createMany({
        data: accessLogs,
      });

      console.log(`[Aprovação] Transação: ${idsToUpdate.length} docs + ${accessLogs.length} logs criados`);

      return { count: idsToUpdate.length, documents: documentsToUpdate };
    });

    // Verificar se algum documento já foi processado por outro admin (race condition)
    if (result.count < documentIds.length) {
      const alreadyProcessed = documentIds.length - result.count;
      console.warn(`[Aprovação] ⚠️ Conflito: ${alreadyProcessed} documento(s) já processados por outro admin`);

      return NextResponse.json({
        success: false,
        error: `${alreadyProcessed} documento(s) já foram processados por outro administrador`,
        processedCount: result.count,
        conflictCount: alreadyProcessed,
      }, { status: 409 }); // 409 Conflict
    }

    console.log(`[Aprovação] ✅ Sucesso: ${result.count} documentos ${action === 'approve' ? 'aprovados' : 'rejeitados'}`);

    // Invalidate cache
    CacheInvalidation.courseDocuments().catch(console.error);

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
