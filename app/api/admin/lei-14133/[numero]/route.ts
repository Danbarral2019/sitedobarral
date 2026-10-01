import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors/api-error';

/**
 * PUT /api/admin/lei-14133/[numero]
 * Atualiza um artigo da Lei 14.133/2021 no banco de dados
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const { numero } = await params;
  try {
    // Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Unauthorized');
    }
    const body = await request.json();

    // Validar dados
    if (!body.ementa || !body.ementa.trim()) {
      throw new ValidationError('O texto do artigo (ementa) é obrigatório');
    }

    // Verificar se artigo existe
    const artigoExistente = await prisma.leiArticle.findUnique({
      where: { numero },
    });

    if (!artigoExistente) {
      throw new NotFoundError(`Artigo ${numero}`);
    }

    // Atualizar artigo no banco de dados
    const artigoAtualizado = await prisma.leiArticle.update({
      where: { numero },
      data: {
        titulo: body.titulo || null,
        capituloCompleto: body.capituloCompleto || null,
        ementa: body.ementa,
        capitulo: body.capitulo || artigoExistente.capitulo,
        secao: body.secao || null,
      },
    });

    // Invalidate Lei 14.133 articles cache
    await CacheInvalidation.leiArticles();

    return NextResponse.json({
      success: true,
      message: `Artigo ${numero} atualizado com sucesso`,
      updated: {
        numero: artigoAtualizado.numero,
        title: artigoAtualizado.titulo || '',
        characterCount: artigoAtualizado.ementa.length,
        updatedAt: artigoAtualizado.updatedAt,
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/admin/lei-14133/[numero]
 * Retorna um artigo específico (para preview/validação)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Unauthorized');
    }

    const { numero } = await params;

    // Buscar artigo no banco de dados
    const artigo = await prisma.leiArticle.findUnique({
      where: { numero },
    });

    if (!artigo) {
      throw new NotFoundError(`Artigo ${numero}`);
    }

    return NextResponse.json({
      success: true,
      article: {
        numero: artigo.numero,
        titulo: artigo.titulo || undefined,
        capituloCompleto: artigo.capituloCompleto || undefined,
        ementa: artigo.ementa,
        capitulo: artigo.capitulo,
        secao: artigo.secao || undefined,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
