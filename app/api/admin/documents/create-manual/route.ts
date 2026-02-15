import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { CacheInvalidation } from '@/lib/cache/redis-client';

/**
 * POST /api/admin/documents/create-manual
 * Cria um documento manualmente (sem upload de arquivo)
 * Específico para enunciados e súmulas
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      courseId,
      title,
      description,
      category,
      isPublic,
      tags,
      leiArticles,
      entityType,
      enunciadoNumber,
      textContent,
      notes,
    } = body;

    // Validações
    if (!courseId || !title) {
      return NextResponse.json(
        { error: 'Curso e título são obrigatórios' },
        { status: 400 }
      );
    }

    if (!textContent) {
      return NextResponse.json(
        { error: 'Texto do documento é obrigatório' },
        { status: 400 }
      );
    }

    console.log('[Create Manual] Criando documento:', {
      courseId,
      title,
      category,
      entityType,
      enunciadoNumber,
    });

    // Montar notas com informações estruturadas
    const notesContent = [
      entityType ? `Instituição: ${entityType}` : null,
      enunciadoNumber ? `Número: ${enunciadoNumber}` : null,
      ``,
      `Texto Completo:`,
      textContent,
      notes ? `\n\nObservações:\n${notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Criar documento
    const document = await prisma.document.create({
      data: {
        title,
        description: description || textContent.substring(0, 200),
        type: 'link', // Documentos manuais são tipo 'link'
        url: '', // Sem URL, conteúdo está nas notes
        category: category || 'apostila',
        courseId,
        isPublic: isPublic || false,
        tags: tags || JSON.stringify([entityType?.toLowerCase(), category].filter(Boolean)),
        leiArticles: leiArticles ? JSON.stringify(leiArticles) : null,
        content: notesContent,
        entityType: entityType || null,
        enunciadoNumber: enunciadoNumber || null,
        uploadedAt: new Date(),
      },
    });

    console.log('[Create Manual] ✅ Documento criado:', document.id);

    // Invalidate cache
    CacheInvalidation.courseDocuments().catch(console.error);

    return NextResponse.json(
      {
        success: true,
        document: {
          id: document.id,
          title: document.title,
          courseId: document.courseId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Create Manual] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao criar documento' },
      { status: 500 }
    );
  }
});
