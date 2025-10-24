import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// POST - Adicionar vídeo
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, title, description, youtubeUrl } = body;

    if (!courseId || !title || !youtubeUrl) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Extrair ID do YouTube da URL
    const youtubeId = extractYoutubeId(youtubeUrl);
    if (!youtubeId) {
      return NextResponse.json(
        { error: 'URL do YouTube inválida' },
        { status: 400 }
      );
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

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error('Erro ao adicionar vídeo:', error);
    return NextResponse.json(
      { error: 'Erro ao adicionar vídeo' },
      { status: 500 }
    );
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
