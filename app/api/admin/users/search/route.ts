import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/users/search?q=...
 * Busca usuários por nome ou email (case-insensitive). Limite 20.
 */
export const GET = withAdminApi(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
    take: 20,
  });
  return NextResponse.json({ users });
});
