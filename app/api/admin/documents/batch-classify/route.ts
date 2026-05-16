import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { classifyDocumentEnhanced, bulkClassify } from '@/lib/auto-classifier';
import { courses } from '@/data/courses';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/admin/documents/batch-classify
 * Classifica múltiplos documentos automaticamente
 *
 * Body:
 * {
 *   documentIds: string[],
 *   useAI?: boolean,  // Se true, usa Claude AI para baixa confiança
 *   autoApply?: boolean // Se true, aplica classificações automaticamente (alta confiança apenas)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação de admin
    const token = request.cookies.get('auth-token')?.value || request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Parse do body
    const body = await request.json();
    const { documentIds, useAI = true, autoApply = false } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'documentIds deve ser um array não vazio' },
        { status: 400 }
      );
    }

    // Limite de documentos por request (evitar timeout)
    const MAX_BATCH_SIZE = 50;
    if (documentIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Máximo ${MAX_BATCH_SIZE} documentos por vez` },
        { status: 400 }
      );
    }

    // Buscar documentos
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        courseId: true,
        tags: true,
      },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum documento encontrado' },
        { status: 404 }
      );
    }

    // Classificar documentos
    const classifications = [];
    const updatedDocuments = [];
    const errors = [];

    for (const doc of documents) {
      try {
        let classification;

        if (useAI) {
          // Usa análise avançada com Claude (assíncrono)
          classification = await classifyDocumentEnhanced(
            doc.title,
            doc.description || '',
            false // forceBasic = false (permite Claude)
          );
        } else {
          // Usa apenas análise básica (síncrono, mais rápido)
          const basicResults = bulkClassify([{
            title: doc.title,
            description: doc.description || '',
          }]);

          const basic = basicResults[0];
          classification = {
            courseSlugs: [basic.courseSlug],
            category: basic.category,
            tags: basic.tags,
            confidence: basic.confidence,
            source: 'basic' as const,
          };
        }

        // Converte slug para ID (database usa IDs numéricos)
        const courseIds = classification.courseSlugs
          .map(slug => {
            const course = courses.find(c => c.slug === slug);
            return course?.id;
          })
          .filter(Boolean) as string[];

        // Se autoApply ativado e confiança alta, atualiza no banco
        let wasApplied = false;
        if (autoApply && classification.confidence >= 70) {
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              courseId: courseIds[0] || doc.courseId, // Mantém original se não encontrar
              category: classification.category,
              tags: classification.tags.join(', '), // Converte array para string
            },
          });
          wasApplied = true;
          updatedDocuments.push(doc.id);
        }

        classifications.push({
          documentId: doc.id,
          title: doc.title,
          current: {
            courseId: doc.courseId,
            category: doc.category,
            tags: doc.tags?.split(',').map(t => t.trim()).filter(Boolean) || [],
          },
          suggested: {
            courseIds,
            courseSlugs: classification.courseSlugs,
            category: classification.category,
            tags: classification.tags,
            confidence: classification.confidence,
            source: classification.source,
            reasoning: classification.reasoning,
            suggestedArticles: classification.suggestedArticles,
          },
          applied: wasApplied,
        });

      } catch (error) {
        apiLogger.error({ err: error }, `Erro ao classificar documento ${doc.id}:`);
        errors.push({
          documentId: doc.id,
          title: doc.title,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    // Estatísticas
    const stats = {
      total: documents.length,
      classified: classifications.length,
      autoApplied: updatedDocuments.length,
      errors: errors.length,
      averageConfidence: classifications.length > 0
        ? Math.round(
            classifications.reduce((sum, c) => sum + c.suggested.confidence, 0) / classifications.length
          )
        : 0,
      bySource: {
        basic: classifications.filter(c => c.suggested.source === 'basic').length,
        claude: classifications.filter(c => c.suggested.source === 'claude').length,
        hybrid: classifications.filter(c => c.suggested.source === 'hybrid').length,
      },
    };

    // Invalidate cache if any documents were auto-applied
    if (updatedDocuments.length > 0) {
      CacheInvalidation.courseDocuments().catch(console.error);
    }

    return NextResponse.json({
      success: true,
      classifications,
      stats,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao classificar documentos em lote:');
    return NextResponse.json(
      { error: 'Erro ao classificar documentos' },
      { status: 500 }
    );
  }
}
