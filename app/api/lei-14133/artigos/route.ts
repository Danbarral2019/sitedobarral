import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/lei-14133/artigos
 * Retorna todos os artigos da Lei 14.133/2021 do banco de dados
 */
export async function GET() {
  try {
    const artigos = await prisma.leiArticle.findMany({
      orderBy: {
        numero: 'asc',
      },
    });

    // Formatar para compatibilidade com formato esperado pela página
    const artigosMap: Record<string, {
      numero: string;
      ementa: string;
      capitulo: string;
      secao?: string;
      titulo?: string;
      capituloCompleto?: string;
    }> = {};

    artigos.forEach(artigo => {
      artigosMap[artigo.numero] = {
        numero: artigo.numero,
        ementa: artigo.ementa,
        capitulo: artigo.capitulo,
        secao: artigo.secao || undefined,
        titulo: artigo.titulo || undefined,
        capituloCompleto: artigo.capituloCompleto || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      artigos: artigosMap,
    });
  } catch (error) {
    apiLogger.error({ err: error }, '[Lei 14.133 Artigos API] Error:');
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao buscar artigos',
      },
      { status: 500 }
    );
  }
}
