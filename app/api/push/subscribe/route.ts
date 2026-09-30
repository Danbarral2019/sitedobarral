import { NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { prisma } from '@/lib/prisma';
import { isAllowedPushEndpoint, MAX_PUSH_SUBSCRIPTIONS_PER_USER } from '@/lib/push-endpoint';

const isKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 512;

// POST - Save push subscription for the authenticated user
export const POST = withUserApi(async (request, { user }) => {
  const body = await request.json().catch(() => ({}));
  const endpoint: unknown = body?.endpoint;
  const keys = body?.keys;

  if (!endpoint || !isKey(keys?.p256dh) || !isKey(keys?.auth)) {
    throw new ValidationError('Dados de subscription invalidos');
  }

  // Só serviços de push conhecidos (https): o envio faz POST para este endpoint
  if (!isAllowedPushEndpoint(endpoint)) {
    throw new ValidationError('Endpoint de push não suportado');
  }

  // Upsert: if endpoint exists, update; otherwise create
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: user.userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    create: {
      userId: user.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  // Mantém só as assinaturas mais recentes do usuário
  const excess = await prisma.pushSubscription.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    skip: MAX_PUSH_SUBSCRIPTIONS_PER_USER,
    select: { id: true },
  });
  if (excess.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: excess.map((s) => s.id) }, userId: user.userId },
    });
  }

  return NextResponse.json({ success: true });
});

// DELETE - Remove push subscription by endpoint
export const DELETE = withUserApi(async (request, { user }) => {
  const { endpoint } = await request.json();

  if (!endpoint) {
    throw new ValidationError('Endpoint obrigatorio');
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: user.userId },
  });

  return NextResponse.json({ success: true });
});
