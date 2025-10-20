import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { rateLimiters } from '@/lib/rate-limit';

const prisma = new PrismaClient();

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
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (isRead !== null) {
      where.isRead = isRead === 'true';
    }

    const contacts = await prisma.contactForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ contacts });
  } catch {
    console.error('Erro ao listar contatos:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar contatos' },
      { status: 500 }
    );
  }
}
