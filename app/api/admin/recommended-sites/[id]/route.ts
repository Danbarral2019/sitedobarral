import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { apiLogger } from "@/lib/logger";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await prisma.recommendedSite.delete({
      where: { id },
    });

    // Invalidate cache
    CacheInvalidation.recommendedSites().catch(console.error);

    return NextResponse.json({ message: 'Site removido com sucesso' });
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao remover site:');
    return NextResponse.json({ error: 'Erro ao remover site' }, { status: 500 });
  }
}
