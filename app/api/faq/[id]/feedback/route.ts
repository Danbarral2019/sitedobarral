import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// POST /api/faq/[id]/feedback - Enviar feedback sobre FAQ
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: faqId } = params;
    const body = await request.json();
    const { wasHelpful, comment } = body;

    // Validar wasHelpful
    if (typeof wasHelpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo wasHelpful é obrigatório (true ou false)' },
        { status: 400 }
      );
    }

    // Verificar se FAQ existe
    const faq = await prisma.fAQ.findUnique({
      where: { id: faqId },
    });

    if (!faq) {
      return NextResponse.json(
        { error: 'Pergunta não encontrada' },
        { status: 404 }
      );
    }

    // Obter informações do usuário (se autenticado)
    let userEmail = null;
    try {
      const authResult = await verifyAuth(request);
      if (authResult.valid && authResult.user) {
        userEmail = authResult.user.email;
      }
    } catch {
      // Ignorar erro de autenticação - feedback pode ser anônimo
    }

    // Obter IP do usuário
    const ip = request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                'unknown';

    // Criar feedback
    await prisma.fAQFeedback.create({
      data: {
        faqId,
        wasHelpful,
        comment: comment?.trim() || null,
        userEmail,
        ip,
      },
    });

    // Atualizar contadores na FAQ
    if (wasHelpful) {
      await prisma.fAQ.update({
        where: { id: faqId },
        data: { helpfulCount: { increment: 1 } },
      });
    } else {
      await prisma.fAQ.update({
        where: { id: faqId },
        data: { notHelpfulCount: { increment: 1 } },
      });
    }

    return NextResponse.json({
      message: 'Feedback registrado com sucesso',
      wasHelpful,
    });
  } catch (error) {
    console.error('Error submitting FAQ feedback:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar feedback' },
      { status: 500 }
    );
  }
}
