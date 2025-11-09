import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Type para DOUStagingDocument usado neste endpoint
 */
interface DOUStagingDoc {
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
  reasoning: string | null;
  approvalStatus: string;
}

/**
 * POST /api/admin/dou/approve
 *
 * Aprova ou rejeita documentos DOU da tabela DOUStagingDocument.
 *
 * Body:
 * {
 *   documentId: string;           // ID do DOUStagingDocument
 *   action: 'approve' | 'reject';
 *   courseIds?: string[];         // Para approve: cursos a vincular
 *   adminNotes?: string;          // Observações do admin
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminEmail = authResult.user.email;

    // 2. Parse do body
    const body = await request.json();
    const { documentId, action, courseIds, adminNotes } = body;

    // 3. Validações básicas
    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json(
        { error: 'documentId é obrigatório' },
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
        { error: 'Selecione pelo menos um curso para vincular o documento' },
        { status: 400 }
      );
    }

    // 4. Buscar documento no staging
    const stagingDoc = await prisma.dOUStagingDocument.findUnique({
      where: { id: documentId },
    });

    if (!stagingDoc) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // 5. Verificar se já foi aprovado/rejeitado
    if (stagingDoc.finalDecision) {
      return NextResponse.json(
        {
          error: `Documento já foi ${stagingDoc.finalDecision === 'approved' ? 'aprovado' : 'rejeitado'} anteriormente`,
          decision: stagingDoc.finalDecision,
          reviewedBy: stagingDoc.reviewedBy,
          reviewedAt: stagingDoc.reviewedAt,
        },
        { status: 409 }
      );
    }

    // 6. Executar aprovação ou rejeição
    if (action === 'approve') {
      return await handleApproval(stagingDoc, courseIds, adminEmail, adminNotes);
    } else {
      return await handleRejection(stagingDoc, adminEmail, adminNotes);
    }

  } catch (error) {
    console.error('[DOU Approve] Error:', error);
    return NextResponse.json(
      {
        error: 'Erro ao processar aprovação/rejeição',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

/**
 * Aprova documento e cria entrada na tabela Document
 */
async function handleApproval(
  stagingDoc: DOUStagingDoc,
  courseIds: string[],
  adminEmail: string,
  adminNotes?: string
) {
  try {
    // Mapear categoria DOU para categoria Document
    const categoryMap: Record<string, string> = {
      'fonte_agu': 'parecer',
      'ato_normativo': 'legislacao',
      'acordao_tcu': 'acordao',
      'sumula': 'sumula',
      'outros': 'outro',
    };

    const documentCategory = categoryMap[stagingDoc.category] || 'outro';

    // Verificar duplicatas (mesmo douUrl já existe?)
    const existingDoc = await prisma.document.findFirst({
      where: { douUrl: stagingDoc.url },
    });

    if (existingDoc) {
      return NextResponse.json(
        {
          error: 'Documento já existe no acervo',
          existingDocumentId: existingDoc.id,
        },
        { status: 409 }
      );
    }

    // Parse da data de publicação (DD/MM/YYYY → DateTime)
    let parsedDate: Date | undefined;
    try {
      const [day, month, year] = stagingDoc.publishDate.split('/').map(Number);
      parsedDate = new Date(year, month - 1, day);
    } catch {
      console.warn('[DOU Approve] Erro ao parsear data:', stagingDoc.publishDate);
      parsedDate = undefined;
    }

    // Transação atômica: criar Document + atualizar Staging + log
    const result = await prisma.$transaction(async (tx) => {
      // Criar documento principal
      const newDoc = await tx.document.create({
        data: {
          title: stagingDoc.title,
          description: stagingDoc.abstract,
          type: 'link',
          url: stagingDoc.url,
          category: documentCategory,
          courseId: courseIds[0] || null, // Primeiro curso (principal)
          isPublic: false, // Admin decide depois
          tags: JSON.stringify([]),
          leiArticles: JSON.stringify([]),
          content: stagingDoc.fullContent || stagingDoc.abstract,
          douUrl: stagingDoc.url,
          douData: parsedDate,
          douSecao: stagingDoc.section,
          douPagina: stagingDoc.page,
          douEdicao: stagingDoc.edition,
          reviewed: true,
          reviewedAt: new Date(),
          reviewedBy: adminEmail,
          adminNotes: adminNotes || null,
          aiClassification: JSON.stringify({
            category: stagingDoc.category,
            confidence: stagingDoc.confidence,
            reasoning: JSON.parse(stagingDoc.reasoning || '[]'),
            approvalStatus: stagingDoc.approvalStatus,
          }),
        },
      });

      // Atualizar staging document
      await tx.dOUStagingDocument.update({
        where: { id: stagingDoc.id },
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

      // Log de auditoria
      await tx.accessLog.create({
        data: {
          userId: adminEmail,
          action: 'dou_approve_document',
          resourceType: 'document',
          resourceId: newDoc.id,
          details: JSON.stringify({
            stagingDocId: stagingDoc.id,
            courseIds,
            category: documentCategory,
            douSection: stagingDoc.section,
          }),
        },
      });

      return newDoc;
    });

    return NextResponse.json({
      success: true,
      message: 'Documento aprovado e incorporado ao acervo',
      documentId: result.id,
      courseIds: courseIds,
    });

  } catch (error) {
    console.error('[DOU Approve] Approval error:', error);
    throw error;
  }
}

/**
 * Rejeita documento (apenas marca no staging, não cria Document)
 */
async function handleRejection(
  stagingDoc: DOUStagingDoc,
  adminEmail: string,
  adminNotes?: string
) {
  try {
    // Atualizar staging document
    await prisma.dOUStagingDocument.update({
      where: { id: stagingDoc.id },
      data: {
        approvalStatus: 'manually_rejected',
        reviewedBy: adminEmail,
        reviewedAt: new Date(),
        adminNotes: adminNotes || null,
        finalDecision: 'rejected',
      },
    });

    // Log de auditoria
    await prisma.accessLog.create({
      data: {
        userId: adminEmail,
        action: 'dou_reject_document',
        resourceType: 'dou_staging',
        resourceId: stagingDoc.id,
        details: JSON.stringify({
          category: stagingDoc.category,
          douSection: stagingDoc.section,
          reason: adminNotes || 'Sem observações',
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Documento rejeitado',
      stagingDocId: stagingDoc.id,
    });

  } catch (error) {
    console.error('[DOU Approve] Rejection error:', error);
    throw error;
  }
}
