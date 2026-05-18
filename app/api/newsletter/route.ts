import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { RateLimitError } from '@/lib/errors/api-error';
import { addSubscriber, unsubscribeSubscriber, isMailChimpConfigured } from '@/lib/mailchimp';
import { prisma } from '@/lib/prisma';
import { trackServerEvent } from '@/lib/monitoring/events';
import { apiLogger } from "@/lib/logger";

// POST - Cadastrar na newsletter
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 cadastros por minuto (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`form:newsletter:${ip}`, 10, 60);
    const { email, name, interests, source } = await request.json();

    // Saneamento de source: aceita apenas string curta; demais valores viram null
    // para evitar abuso (string gigante, tipo inesperado vindo do body).
    const safeSource =
      typeof source === 'string' && source.length > 0 && source.length <= 50
        ? source
        : null;

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
            source: safeSource ?? existing.source, // preserves original if no valid new value
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
            apiLogger.error({
                            message: error.message,
                            error: error
                          }, '[MailChimp] ERRO na reativação:');
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
        source: safeSource,
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
        apiLogger.error({
                    message: error.message,
                    error: error,
                    stack: error.stack
                  }, '[MailChimp] ERRO DETALHADO:');
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
    apiLogger.error({ err: error }, 'Erro ao cadastrar newsletter:');
    return NextResponse.json(
      { error: 'Erro ao cadastrar. Tente novamente.' },
      { status: 500 }
    );
  }
}

// GET - Listar inscritos (admin apenas)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação admin (decodificar token e verificar role)
    const { verifyAuth } = await import('@/lib/auth');
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
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
    apiLogger.error({ err: error }, 'Erro ao listar inscritos:');
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
        apiLogger.error({ err: error }, '[MailChimp] Erro ao cancelar inscrição:');
        // Não falha a requisição se MailChimp falhar - email já foi desativado no BD
      }
    }

    return NextResponse.json({
      message: 'Inscrição cancelada com sucesso'
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao cancelar inscrição:');
    return NextResponse.json(
      { error: 'Erro ao cancelar inscrição' },
      { status: 500 }
    );
  }
}
