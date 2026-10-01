import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { prisma } from '@/lib/prisma';
import {
  requestNewsletterSubscription,
  SUBSCRIBE_GENERIC_MESSAGE,
  UNSUBSCRIBE_GENERIC_MESSAGE,
} from '@/lib/newsletter/subscriptions';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, RateLimitError, ValidationError } from '@/lib/errors/api-error';

// POST - Pedido de inscrição na newsletter (double opt-in).
// A inscrição fica pendente até o clique no link enviado por e-mail. A resposta
// é a mesma para e-mail novo, pendente ou já confirmado, para não revelar se o
// endereço está na lista.
export async function POST(request: NextRequest) {
  try {
    // Rate limiting por IP: 10 pedidos por minuto (Redis). O limite por e-mail
    // fica em requestNewsletterSubscription (cooldown no banco + Redis).
    const ip = getClientIp(request);
    await enforceRateLimit(`form:newsletter:${ip}`, 10, 60);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError('Requisição inválida');
    }
    const { email, name, interests, source } = body ?? {};

    // Saneamento de source: aceita apenas string curta; demais valores viram null
    // para evitar abuso (string gigante, tipo inesperado vindo do body).
    const safeSource =
      typeof source === 'string' && source.length > 0 && source.length <= 50
        ? source
        : null;
    const safeName = typeof name === 'string' ? name : null;
    const safeInterests = Array.isArray(interests)
      ? interests.filter((i): i is string => typeof i === 'string' && i.length <= 100).slice(0, 20)
      : null;

    if (!email || typeof email !== 'string') {
      throw new ValidationError('E-mail é obrigatório');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.length > 254 || !emailRegex.test(email.trim())) {
      throw new ValidationError('E-mail inválido');
    }

    await requestNewsletterSubscription({
      email,
      name: safeName,
      interests: safeInterests,
      source: safeSource,
    });

    return NextResponse.json({ message: SUBSCRIBE_GENERIC_MESSAGE, pendingConfirmation: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return handleApiError(
        new RateLimitError(
          'Você está enviando cadastros muito rapidamente. Por favor, aguarde alguns instantes.'
        )
      );
    }
    return handleApiError(error);
  }
}

// GET - Listar inscritos (admin apenas)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação admin (decodificar token e verificar role)
    const { verifyAuth } = await import('@/lib/auth');
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Não autorizado');
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
    return handleApiError(error);
  }
}

// DELETE - Endpoint antigo de descadastro por `?email=`.
// Não descadastra mais: qualquer pessoa conseguia cancelar a inscrição de
// qualquer e-mail. O descadastro agora exige o link assinado presente no rodapé
// de cada envio (POST /api/newsletter/unsubscribe). A resposta é genérica e não
// revela se o e-mail está inscrito.
export async function DELETE() {
  return NextResponse.json({ message: UNSUBSCRIBE_GENERIC_MESSAGE });
}
