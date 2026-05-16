import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { publishToSocialMedia } from '@/lib/social-publisher';
import { CacheInvalidation, withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { broadcastPush } from '@/lib/push-notifications';
import { apiLogger } from "@/lib/logger";

// GET - Lista posts do blog com paginação
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const result = await withCache(
      CacheKeys.blogPosts(page, limit),
      async () => {
        const [posts, total] = await Promise.all([
          prisma.blogPost.findMany({
            orderBy: {
              publishedAt: 'desc'
            },
            take: limit,
            skip: skip,
          }),
          prisma.blogPost.count()
        ]);

        return {
          posts,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        };
      },
      CACHE_TTL.BLOG_POSTS,
      { prefix: 'blog' }
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao listar posts:');
    return NextResponse.json(
      { error: 'Erro ao listar posts' },
      { status: 500 }
    );
  }
});

// POST - Cria novo post
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const data = await request.json();
    const { title, slug, excerpt, content, author, publishedAt, isPublished, autoPublishSocial, tags, leiArticles } = data;

    if (!title || !slug || !excerpt || !content || !author) {
      return NextResponse.json(
        { error: 'Campos obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Verificar se slug já existe
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug }
    });

    if (existingPost) {
      return NextResponse.json(
        { error: 'Já existe um post com este slug' },
        { status: 400 }
      );
    }

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        author,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        isPublished: isPublished ?? false,
        autoPublishSocial: autoPublishSocial ?? true,
        tags: tags ? JSON.stringify(tags) : null,
        leiArticles: leiArticles ? JSON.stringify(leiArticles) : null,
      },
    });

    // Se publicado E autoPublishSocial habilitado, publicar nas redes sociais
    if (isPublished && autoPublishSocial) {
      console.log(`[BlogPost] Publicando post ${post.id} nas redes sociais...`);

      // Publicar em background (não bloqueia a resposta)
      publishToSocialMedia(post.id)
        .then((result) => {
          console.log('[BlogPost] Resultado publicação social:', result);
        })
        .catch((error) => {
          apiLogger.error({ err: error }, '[BlogPost] Erro ao publicar nas redes sociais:');
        });
    }

    // Invalidate cache
    CacheInvalidation.blogPosts().catch(console.error);

    // Fire-and-forget push notification when blog post is published
    if (isPublished) {
      broadcastPush({
        title: 'Novo artigo no Blog',
        body: post.title,
        url: `/blog/${post.slug}`,
      }).catch(console.error);
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao criar post:');
    return NextResponse.json(
      { error: 'Erro ao criar post' },
      { status: 500 }
    );
  }
});
