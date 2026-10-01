import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError } from '@/lib/errors/api-error';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      throw new AuthenticationError('Não autorizado');
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
      throw new AuthenticationError('Não autorizado');
    }

    await prisma.courseVideo.delete({
      where: { id },
    });

    // Invalidate cache
    CacheInvalidation.courseVideos().catch(console.error);

    return NextResponse.json({ message: 'Vídeo removido com sucesso' });
  } catch (error) {
    return handleApiError(error);
  }
}
