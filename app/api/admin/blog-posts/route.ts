import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Lista todos os posts do blog
export const GET = withAdminAuth(async () => {
  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: {
        publishedAt: 'desc'
      }
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Erro ao listar posts:', error);
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
    const { title, slug, excerpt, content, author, publishedAt, isPublished, tags } = data;

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
        tags: tags ? JSON.stringify(tags) : null,
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar post:', error);
    return NextResponse.json(
      { error: 'Erro ao criar post' },
      { status: 500 }
    );
  }
});
