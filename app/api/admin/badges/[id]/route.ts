import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';

export const DELETE = withAdminApi<{ id: string }>(async (_request, { params }) => {
  const { id } = params;
  const existing = await prisma.badge.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Badge');
  }
  await prisma.badge.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
