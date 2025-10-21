import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { PrismaClient } from '@prisma/client';
import { publishToSocialMedia } from '@/lib/social-publisher';

const prisma = new PrismaClient();

// GET - Busca um post específico
export const GET = withAdminAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;

    const post = await prisma.blogPost.findUnique({
      where: { id }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Erro ao buscar post:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar post' },
      { status: 500 }
    );
  }
});

// PUT - Atualiza um post
export const PUT = withAdminAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;
    const data = await request.json();
    const { title, slug, excerpt, content, author, publishedAt, isPublished, autoPublishSocial, tags } = data;

    // Verificar se o post existe
    const existingPost = await prisma.blogPost.findUnique({
      where: { id }
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    // Se o slug mudou, verificar se já existe outro post com o novo slug
    if (slug && slug !== existingPost.slug) {
      const slugExists = await prisma.blogPost.findUnique({
        where: { slug }
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'Já existe um post com este slug' },
          { status: 400 }
        );
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
      },
    });

    // Se está sendo publicado agora (mudou de não publicado para publicado) E autoPublishSocial está habilitado
    const wasPublished = existingPost.isPublished;
    const isNowPublished = isPublished ?? existingPost.isPublished;
    const shouldAutoPublish = autoPublishSocial ?? existingPost.autoPublishSocial;

    if (!wasPublished && isNowPublished && shouldAutoPublish) {
      console.log(`[BlogPost] Publicando post ${post.id} nas redes sociais...`);

      // Publicar em background (não bloqueia a resposta)
      publishToSocialMedia(post.id)
        .then((result) => {
          console.log('[BlogPost] Resultado publicação social:', result);
        })
        .catch((error) => {
          console.error('[BlogPost] Erro ao publicar nas redes sociais:', error);
        });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Erro ao atualizar post:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar post' },
      { status: 500 }
    );
  }
});

// DELETE - Remove um post
export const DELETE = withAdminAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;

    const post = await prisma.blogPost.findUnique({
      where: { id }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    await prisma.blogPost.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar post:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar post' },
      { status: 500 }
    );
  }
});
