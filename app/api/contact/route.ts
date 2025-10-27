import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimiters } from '@/lib/rate-limit';
import { sendContactNotification } from '@/lib/email';


// POST - Enviar mensagem de contato
export async function POST(request: NextRequest) {
  // Rate limiting: 10 envios por minuto
  try {
    await rateLimiters.forms.check(request, 10);
  } catch {
    return NextResponse.json(
      { error: 'Você está enviando mensagens muito rapidamente. Por favor, aguarde alguns instantes.' },
      { status: 429 }
    );
  }

  try {
    const { name, email, phone, courseInterest, message } = await request.json();

    // Validações básicas
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Nome, e-mail e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    // Validação de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'E-mail inválido' },
        { status: 400 }
      );
    }

    // Salvar no banco de dados
    const contact = await prisma.contactForm.create({
      data: {
        name,
        email,
        phone: phone || null,
        courseInterest: courseInterest || null,
        message,
      },
    });

    // Se for um depoimento, criar registro de Testimonial para moderação
    if (courseInterest === 'depoimento') {
      const colors = [
        'from-blue-400 to-blue-600',
        'from-green-400 to-green-600',
        'from-purple-400 to-purple-600',
        'from-orange-400 to-orange-600',
        'from-pink-400 to-pink-600',
        'from-indigo-400 to-indigo-600',
        'from-red-400 to-red-600',
        'from-teal-400 to-teal-600',
      ];
      const avatar = name.charAt(0).toUpperCase();
      const color = colors[Math.floor(Math.random() * colors.length)];

      try {
        await prisma.testimonial.create({
          data: {
            name,
            email,
            phone: phone || null,
            role: 'Aluno', // Padrão - pode ser editado na moderação
            text: message,
            rating: 5, // Padrão
            avatar,
            color,
            status: 'pending',
            contactFormId: contact.id,
          },
        });
      } catch (error) {
        console.error('Erro ao criar testimonial:', error);
        // Não propaga o erro - o contato já foi salvo
      }
    }

    // Enviar notificação por email ao admin (não bloqueia a resposta)
    sendContactNotification(
      {
        name,
        email,
        phone: phone || null,
        courseInterest: courseInterest || null,
        message,
      },
      contact.id
    ).catch((error) => {
      console.error('Erro ao enviar notificação de contato:', error);
      // Não propaga o erro - o contato já foi salvo com sucesso
    });

    return NextResponse.json(
      {
        message: 'Mensagem enviada com sucesso!',
        contact: {
          id: contact.id,
          createdAt: contact.createdAt
        }
      },
      { status: 201 }
    );
  } catch {
    console.error('Erro ao processar contato:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar mensagem. Tente novamente.' },
      { status: 500 }
    );
  }
}

// GET - Listar contatos (admin apenas)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isRead = searchParams.get('isRead');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: Record<string, unknown> = {};
    if (isRead !== null && isRead !== 'all') {
      where.isRead = isRead === 'true';
    }

    const contacts = await prisma.contactForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const stats = {
      unread: await prisma.contactForm.count({ where: { isRead: false } }),
      read: await prisma.contactForm.count({ where: { isRead: true } }),
    };

    return NextResponse.json({ contacts, stats });
  } catch (error) {
    console.error('Erro ao listar contatos:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar contatos' },
      { status: 500 }
    );
}

// PATCH - Marcar contato como lido/não lido (admin apenas)
export async function PATCH(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, isRead } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID do contato é obrigatório' },
        { status: 400 }
      );
    }

    const contact = await prisma.contactForm.update({
      where: { id },
      data: { isRead: isRead !== undefined ? isRead : true },
    });

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error('Erro ao atualizar contato:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar contato' },
      { status: 500 }
    );
}

// DELETE - Deletar contato (admin apenas)
export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID do contato é obrigatório' },
        { status: 400 }
      );
    }

    await prisma.contactForm.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Contato deletado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar contato:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar contato' },
      { status: 500 }
    );
}
