import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';
import { CacheInvalidation, withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';


// GET - Lista todas as publicações
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // livro, artigo, noticia

    const where = type ? { type } : {};

    const result = await withCache(
      CacheKeys.publications(type),
      async () => {
        const publications = await prisma.publication.findMany({
          where,
          orderBy: {
            publishedAt: 'desc'
          }
        });
        return { publications };
      },
      CACHE_TTL.PUBLICATIONS,
      { prefix: 'pub' }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao listar publicações:', error);
    return NextResponse.json(
      { error: 'Erro ao listar publicações' },
      { status: 500 }
    );
  }
});

// POST - Cria nova publicação
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const data = await request.json();
    const {
      type,
      title,
      description,
      content,
      author,
      publishedAt,
      isPublished,
      publisher,
      isbn,
      coverImage,
      externalUrl,
      journal,
      eventDate,
      location
    } = data;

    if (!type || !title || !description || !author) {
      return NextResponse.json(
        { error: 'Campos obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Validar tipo
    if (!['livro', 'artigo', 'noticia'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Use: livro, artigo ou noticia' },
        { status: 400 }
      );
    }

    const publication = await prisma.publication.create({
      data: {
        type,
        title,
        description,
        content: content || null,
        author,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        isPublished: isPublished ?? false,
        publisher: publisher || null,
        isbn: isbn || null,
        coverImage: coverImage || null,
        externalUrl: externalUrl || null,
        journal: journal || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        location: location || null,
      },
    });

    // Invalidate cache
    CacheInvalidation.publications().catch(console.error);

    return NextResponse.json({ publication }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar publicação:', error);
    return NextResponse.json(
      { error: 'Erro ao criar publicação' },
      { status: 500 }
    );
  }
});
