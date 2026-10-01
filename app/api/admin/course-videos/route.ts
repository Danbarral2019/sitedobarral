import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, ValidationError } from '@/lib/errors/api-error';

// POST - Adicionar vídeo
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      throw new AuthenticationError('Não autorizado');
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
      throw new AuthenticationError('Não autorizado');
    }

    const body = await request.json();
    const { courseId, title, description, youtubeUrl } = body;

    if (!courseId || !title || !youtubeUrl) {
      throw new ValidationError('Campos obrigatórios faltando');
    }

    // Extrair ID do YouTube da URL
    const youtubeId = extractYoutubeId(youtubeUrl);
    if (!youtubeId) {
      throw new ValidationError('URL do YouTube inválida');
    }

    // Obter próxima ordem
    const lastVideo = await prisma.courseVideo.findFirst({
      where: { courseId },
      orderBy: { displayOrder: 'desc' },
    });

    const video = await prisma.courseVideo.create({
      data: {
        courseId,
        title,
        description: description || null,
        youtubeUrl,
        youtubeId,
        thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
        displayOrder: lastVideo ? lastVideo.displayOrder + 1 : 0,
        isActive: true,
      },
    });

    // Invalidate cache
    CacheInvalidation.courseVideos().catch(console.error);

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
