import { NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { prisma } from '@/lib/prisma';

// POST - Save push subscription for the authenticated user
export const POST = withUserApi(async (request, { user }) => {
  const { endpoint, keys } = await request.json();

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new ValidationError('Dados de subscription invalidos');
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
