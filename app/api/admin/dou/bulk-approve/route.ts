import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CacheInvalidation } from '@/lib/cache/redis-client';

/**
 * POST /api/admin/dou/bulk-approve
 *
 * Aprova ou rejeita múltiplos documentos DOU em lote.
 *
 * Body:
 * {
 *   documentIds: string[];
 *   action: 'approve' | 'reject';
 *   courseIds?: string[];      // obrigatório para approve
 *   importAs?: string;
 *   adminNotes?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminEmail = authResult.user.email;
    const body = await request.json();
    const { documentIds, action, courseIds, importAs, adminNotes } = body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'documentIds deve ser um array não vazio' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action deve ser "approve" ou "reject"' },
        { status: 400 }
      );
    }

    if (action === 'approve' && (!courseIds || courseIds.length === 0)) {
      return NextResponse.json(
        { error: 'Selecione pelo menos um curso para aprovação em lote' },
        { status: 400 }
      );
    }

    const validImportAs = ['ato_normativo', 'boa_pratica'];
    const importType = importAs && validImportAs.includes(importAs) ? importAs : 'ato_normativo';

    // Buscar todos os documentos
    const stagingDocs = await prisma.dOUStagingDocument.findMany({
      where: {
        id: { in: documentIds },
        finalDecision: null, // Apenas documentos não processados
      },
    });

    const details: { id: string; status: string; error?: string }[] = [];
    let processed = 0;
    let errors = 0;

    for (const doc of stagingDocs) {
      try {
        if (action === 'approve') {
          await processApproval(doc, courseIds, adminEmail!, importType, adminNotes);
        } else {
          await processRejection(doc, adminEmail!, adminNotes);
        }
        details.push({ id: doc.id, status: 'success' });
        processed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        details.push({ id: doc.id, status: 'error', error: message });
        errors++;
      }
    }

    // IDs que não foram encontrados ou já processados
    const processedIds = stagingDocs.map(d => d.id);
    const skippedIds = documentIds.filter((id: string) => !processedIds.includes(id));
    for (const id of skippedIds) {
      details.push({ id, status: 'skipped', error: 'Documento não encontrado ou já processado' });
    }

    // Invalidate cache
    if (processed > 0) {
      CacheInvalidation.douStats().catch(console.error);
      if (action === 'approve') {
        CacheInvalidation.courseDocuments().catch(console.error);
      }
    }

    return NextResponse.json({
      success: errors === 0,
      processed,
      errors,
      skipped: skippedIds.length,
      details,
    });
  } catch (error) {
    console.error('[DOU Bulk] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar operação em lote' },
      { status: 500 }
    );
  }
}

interface StagingDoc {
  id: string;
  title: string;
  abstract: string;
  fullContent: string | null;
  url: string;
  section: string;
  publishDate: string;
  page: string | null;
  edition: string | null;
  category: string;
  confidence: number;
  reasoning: string;
  approvalStatus: string;
}

async function processApproval(
  doc: StagingDoc,
  courseIds: string[],
  adminEmail: string,
  importType: string,
  adminNotes?: string
) {
  // Verificar duplicata
  const existing = await prisma.document.findFirst({
    where: { douUrl: doc.url },
  });
  if (existing) {
    throw new Error('Documento já existe no acervo');
  }

  // Mapear categoria
  let documentCategory: string;
  let tags: string[];

  if (importType === 'boa_pratica') {
    documentCategory = 'boa_pratica';
    tags = ['boas_praticas'];
  } else {
    const categoryMap: Record<string, string> = {
      'fonte_agu': 'parecer',
      'ato_normativo': 'legislacao',
      'acordao_tcu': 'acordao',
      'sumula': 'sumula',
      'outros': 'outro',
    };
    documentCategory = categoryMap[doc.category] || 'outro';
    tags = [];
  }

  // Parse da data
  let parsedDate: Date | undefined;
  try {
    const [day, month, year] = doc.publishDate.split('/').map(Number);
    parsedDate = new Date(year, month - 1, day);
  } catch {
    parsedDate = undefined;
  }

  await prisma.$transaction(async (tx) => {
    const newDoc = await tx.document.create({
      data: {
        title: doc.title,
        description: doc.abstract,
        type: 'link',
        url: doc.url,
        category: documentCategory,
        courseId: courseIds[0] || null,
        isPublic: false,
        tags: JSON.stringify(tags),
        leiArticles: JSON.stringify([]),
        content: doc.fullContent || doc.abstract,
        douUrl: doc.url,
        douData: parsedDate,
        douSecao: doc.section,
        douPagina: doc.page,
        douEdicao: doc.edition,
        reviewed: true,
        reviewedAt: new Date(),
        reviewedBy: adminEmail,
        adminNotes: adminNotes || null,
        aiClassification: JSON.stringify({
          category: doc.category,
          confidence: doc.confidence,
          reasoning: JSON.parse(doc.reasoning || '[]'),
          approvalStatus: doc.approvalStatus,
        }),
      },
    });

    await tx.dOUStagingDocument.update({
      where: { id: doc.id },
      data: {
        approvalStatus: 'manually_approved',
        reviewedBy: adminEmail,
        reviewedAt: new Date(),
        adminNotes: adminNotes || null,
        finalDecision: 'approved',
        imported: true,
        importedAt: new Date(),
        documentId: newDoc.id,
      },
    });

    await tx.accessLog.create({
      data: {
        userId: adminEmail,
        action: 'dou_bulk_approve_document',
        documentId: newDoc.id,
      },
    });
  });
}

async function processRejection(
  doc: StagingDoc,
  adminEmail: string,
  adminNotes?: string
) {
  await prisma.$transaction(async (tx) => {
    await tx.dOUStagingDocument.update({
      where: { id: doc.id },
      data: {
        approvalStatus: 'manually_rejected',
        reviewedBy: adminEmail,
        reviewedAt: new Date(),
        adminNotes: adminNotes || null,
        finalDecision: 'rejected',
      },
    });

    await tx.accessLog.create({
      data: {
        userId: adminEmail,
        action: 'dou_bulk_reject_document',
      },
    });
  });
}
