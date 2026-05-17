import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { publishToSocialMedia } from '@/lib/social-publisher';
import { NotFoundError, ConflictError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { setLeiArticles } from '@/lib/lei-articles';

// GET - Busca um post específico
export const GET = withAdminApi<{ id: string }>(async (
  request: NextRequest,
  ctx
) => {
  const { id } = ctx.params;

  const post = await prisma.blogPost.findUnique({
    where: { id }
  });

  if (!post) {
    apiLogger.warn({ postId: id }, 'Blog post not found');
    throw new NotFoundError('Post');
  }

  return NextResponse.json({ post });
});

// PUT - Atualiza um post
export const PUT = withAdminApi<{ id: string }>(async (
  request: NextRequest,
  ctx
) => {
  const { id } = ctx.params;
  const data = await request.json();
    const { title, slug, excerpt, content, author, publishedAt, isPublished, autoPublishSocial, tags, leiArticles } = data;

    // Verificar se o post existe
    const existingPost = await prisma.blogPost.findUnique({
      where: { id }
    });

    if (!existingPost) {
      apiLogger.warn({ postId: id }, 'Blog post not found for update');
      throw new NotFoundError('Post');
    }

    // Se o slug mudou, verificar se já existe outro post com o novo slug
    if (slug && slug !== existingPost.slug) {
      const slugExists = await prisma.blogPost.findUnique({
        where: { slug }
      });

      if (slugExists) {
        apiLogger.warn({ slug, postId: id }, 'Slug conflict on blog post update');
        throw new ConflictError('Já existe um post com este slug');
      }
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(slug && { slug }),
        ...(excerpt && { excerpt }),
        ...(content && { content }),
        ...(author && { author }),
        ...(publishedAt && { publishedAt: new Date(publishedAt) }),
        ...(typeof isPublished === 'boolean' && { isPublished }),
        ...(typeof autoPublishSocial === 'boolean' && { autoPublishSocial }),
        ...(tags !== undefined && { tags: tags ? JSON.stringify(tags) : null }),
        ...(leiArticles !== undefined && setLeiArticles(leiArticles ?? null)),
      },
    });

    // Se está sendo publicado agora (mudou de não publicado para publicado) E autoPublishSocial está habilitado
    const wasPublished = existingPost.isPublished;
    const isNowPublished = isPublished ?? existingPost.isPublished;
    const shouldAutoPublish = autoPublishSocial ?? existingPost.autoPublishSocial;

    if (!wasPublished && isNowPublished && shouldAutoPublish) {
      apiLogger.info({ postId: post.id }, 'Publishing blog post to social media');

      // Publicar em background (não bloqueia a resposta)
      publishToSocialMedia(post.id)
        .then((result) => {
          apiLogger.info({ postId: post.id, result }, 'Social media publish successful');
        })
        .catch((socialError) => {
          apiLogger.error({ err: socialError, postId: post.id }, 'Failed to publish to social media');
        });
    }

    apiLogger.info({ postId: post.id }, 'Blog post updated successfully');

    // Invalidate cache
    CacheInvalidation.blogPosts().catch(console.error);

    return NextResponse.json({ post });
});

// DELETE - Remove um post
export const DELETE = withAdminApi<{ id: string }>(async (
  request: NextRequest,
  ctx
) => {
  const { id } = ctx.params;

  const post = await prisma.blogPost.findUnique({
    where: { id }
  });

  if (!post) {
    apiLogger.warn({ postId: id }, 'Blog post not found for deletion');
    throw new NotFoundError('Post');
  }

  await prisma.blogPost.delete({
    where: { id }
  });

  apiLogger.info({ postId: id, title: post.title }, 'Blog post deleted successfully');

  // Invalidate cache
  CacheInvalidation.blogPosts().catch(console.error);

  return NextResponse.json({ success: true });
});
