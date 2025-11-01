import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// PUT /api/admin/faq/[id] - Atualizar FAQ
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      question,
      answer,
      category,
      displayOrder,
      isPinned,
      isPublished,
      relatedFAQs,
      relatedDocs,
      keywords,
    } = body;

    // Verificar se FAQ existe
    const existing = await prisma.fAQ.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pergunta não encontrada' },
        { status: 404 }
      );
    }

    // Preparar dados para atualização
    const data: any = {};

    if (question !== undefined) {
      data.question = question.trim();
    }

    if (answer !== undefined) {
      data.answer = answer.trim();
    }

    if (category !== undefined) {
      data.category = category.trim();
    }

    if (displayOrder !== undefined) {
      data.displayOrder = displayOrder;
    }

    if (isPinned !== undefined) {
      data.isPinned = isPinned;
    }

    if (isPublished !== undefined) {
      data.isPublished = isPublished;
    }

    // Atualizar relacionamentos (JSON)
    if (relatedFAQs !== undefined) {
      data.relatedFAQs = Array.isArray(relatedFAQs)
        ? JSON.stringify(relatedFAQs)
        : null;
    }

    if (relatedDocs !== undefined) {
      data.relatedDocs = Array.isArray(relatedDocs)
        ? JSON.stringify(relatedDocs)
        : null;
    }

    if (keywords !== undefined) {
      data.keywords = Array.isArray(keywords)
        ? JSON.stringify(keywords)
        : null;
    }

    // Atualizar FAQ
    const updatedFaq = await prisma.fAQ.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      faq: updatedFaq,
      message: 'Pergunta atualizada com sucesso',
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar pergunta' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/faq/[id] - Deletar FAQ
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;

    // Verificar se FAQ existe
    const existing = await prisma.fAQ.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pergunta não encontrada' },
        { status: 404 }
      );
    }

    // Deletar feedbacks relacionados primeiro
    await prisma.fAQFeedback.deleteMany({
      where: { faqId: id },
    });

    // Deletar FAQ
    await prisma.fAQ.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Pergunta deletada com sucesso',
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar pergunta' },
      { status: 500 }
    );
  }
}
