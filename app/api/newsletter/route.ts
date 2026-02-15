import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { RateLimitError } from '@/lib/errors/api-error';
import { addSubscriber, unsubscribeSubscriber, isMailChimpConfigured } from '@/lib/mailchimp';
import { prisma } from '@/lib/prisma';
import { trackServerEvent } from '@/lib/monitoring/events';

// POST - Cadastrar na newsletter
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 cadastros por minuto (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`form:newsletter:${ip}`, 10, 60);
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

        // Sincronizar com MailChimp (agora aguarda a sincronização)
        if (isMailChimpConfigured()) {
          const [firstName, ...lastNameParts] = (name || existing.name || '').split(' ');
          const lastName = lastNameParts.join(' ');

          try {
            await addSubscriber(email, firstName, lastName, interests);
          } catch (err: unknown) {
            const error = err as Error;
            console.error('[MailChimp] ERRO na reativação:', {
              message: error.message,
              error: error
            });
            // Não falha a requisição se MailChimp falhar - email já foi reativado no BD
          }
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

    // Sincronizar com MailChimp (agora aguarda a sincronização)
    if (isMailChimpConfigured()) {
      const [firstName, ...lastNameParts] = (name || '').split(' ');
      const lastName = lastNameParts.join(' ');

      try {
        await addSubscriber(email, firstName, lastName, interests);
      } catch (err: unknown) {
        const error = err as Error;
        console.error('[MailChimp] ERRO DETALHADO:', {
          message: error.message,
          error: error,
          stack: error.stack
        });
        // Não falha a requisição se MailChimp falhar - email já foi salvo no BD
      }
    }

    trackServerEvent('newsletter_signup');

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
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Você está enviando cadastros muito rapidamente. Por favor, aguarde alguns instantes.' },
        { status: 429 }
      );
    }
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

    // Sincronizar com MailChimp (agora aguarda a sincronização)
    if (isMailChimpConfigured()) {
      try {
        await unsubscribeSubscriber(email);
      } catch (err: unknown) {
        const error = err as Error;
        console.error('[MailChimp] Erro ao cancelar inscrição:', error);
        // Não falha a requisição se MailChimp falhar - email já foi desativado no BD
      }
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
