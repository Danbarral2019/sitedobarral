import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

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
      documentType, // 'enunciado' ou 'sumula'
      institution, // 'IBDA', 'INCP', 'CJF', 'outro'
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
      documentType,
      institution,
    });

    // Montar notas com informações estruturadas
    const notesContent = [
      `Tipo: ${documentType === 'sumula' ? 'Súmula' : 'Enunciado'}`,
      `Instituição: ${institution}`,
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
        type: 'link', // Enunciados/súmulas são tipo 'link'
        url: '', // Sem URL, conteúdo está nas notes
        category: category || 'enunciados',
        courseId,
        isPublic: isPublic || false,
        tags: tags || JSON.stringify([institution.toLowerCase(), documentType]),
        leiArticles: leiArticles ? JSON.stringify(leiArticles) : null,
        notes: notesContent,
        entityType: institution,
        uploadedAt: new Date(),
      },
    });

    console.log('[Create Manual] ✅ Documento criado:', document.id);

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
