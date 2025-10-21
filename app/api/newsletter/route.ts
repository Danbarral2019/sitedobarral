import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { rateLimiters } from '@/lib/rate-limit';
import { addSubscriber, unsubscribeSubscriber, isMailChimpConfigured } from '@/lib/mailchimp';

const prisma = new PrismaClient();

// POST - Cadastrar na newsletter
export async function POST(request: NextRequest) {
  // Rate limiting: 10 cadastros por minuto
  try {
    await rateLimiters.forms.check(request, 10);
  } catch {
    return NextResponse.json(
      { error: 'Você está enviando cadastros muito rapidamente. Por favor, aguarde alguns instantes.' },
      { status: 429 }
    );
  }

  try {
    const { email, name, interests } = await request.json();

    // Validações básicas
    if (!email) {
      return NextResponse.json(
        { error: 'E-mail é obrigatório' },
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

    // Verificar se já existe
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email }
    });

    if (existing) {
      // Se estava inativo, reativar
      if (!existing.isActive) {
        await prisma.newsletterSubscriber.update({
          where: { email },
          data: {
            isActive: true,
            name: name || existing.name,
            interests: interests ? JSON.stringify(interests) : existing.interests,
            unsubscribedAt: null
          }
        });

        // Sincronizar com MailChimp (não bloqueia se falhar)
        if (isMailChimpConfigured()) {
          const [firstName, ...lastNameParts] = (name || existing.name || '').split(' ');
          const lastName = lastNameParts.join(' ');

          addSubscriber(email, firstName, lastName, interests).catch(err => {
            console.error('Erro ao sincronizar com MailChimp:', err);
          });
        }

        return NextResponse.json(
          { message: 'Inscrição reativada com sucesso!' },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: 'Este e-mail já está cadastrado na newsletter' },
        { status: 400 }
      );
    }

    // Criar novo cadastro
    const subscriber = await prisma.newsletterSubscriber.create({
      data: {
        email,
        name: name || null,
        interests: interests ? JSON.stringify(interests) : null,
      },
    });

    // Sincronizar com MailChimp (não bloqueia se falhar)
    if (isMailChimpConfigured()) {
      const [firstName, ...lastNameParts] = (name || '').split(' ');
      const lastName = lastNameParts.join(' ');

      addSubscriber(email, firstName, lastName, interests).catch(err => {
        console.error('Erro ao sincronizar com MailChimp:', err);
      });
    }

    return NextResponse.json(
      {
        message: 'Cadastro realizado com sucesso!',
        subscriber: {
          id: subscriber.id,
          subscribedAt: subscriber.subscribedAt
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao cadastrar newsletter:', error);
    return NextResponse.json(
      { error: 'Erro ao cadastrar. Tente novamente.' },
      { status: 500 }
    );
  }
}

// GET - Listar inscritos (admin apenas)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: Record<string, unknown> = {};
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const subscribers = await prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { subscribedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ subscribers });
  } catch (error) {
    console.error('Erro ao listar inscritos:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar inscritos' },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar inscrição
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'E-mail é obrigatório' },
        { status: 400 }
      );
    }

    // Atualizar para inativo ao invés de deletar
    await prisma.newsletterSubscriber.update({
      where: { email },
      data: {
        isActive: false,
        unsubscribedAt: new Date()
      }
    });

    // Sincronizar com MailChimp (não bloqueia se falhar)
    if (isMailChimpConfigured()) {
      unsubscribeSubscriber(email).catch(err => {
        console.error('Erro ao cancelar inscrição no MailChimp:', err);
      });
    }

    return NextResponse.json({
      message: 'Inscrição cancelada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar inscrição:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar inscrição' },
      { status: 500 }
    );
  }
}
