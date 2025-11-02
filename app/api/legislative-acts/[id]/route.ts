import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/legislative-acts/[id]
 * API pública para buscar um ato normativo específico
 * Incrementa viewCount automaticamente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Buscar ato normativo
    const act = await prisma.legislativeAct.findUnique({
      where: { id: params.id }
    });

    if (!act) {
      return NextResponse.json(
        { error: 'Ato normativo não encontrado' },
        { status: 404 }
      );
    }

    // Incrementar contador de visualizações (fire and forget)
    prisma.legislativeAct.update({
      where: { id: params.id },
      data: {
        viewCount: { increment: 1 }
      }
    }).catch(err => console.error('Erro ao incrementar viewCount:', err));

    // Processar leiArticles (parsear JSON)
    const actWithParsedData = {
      ...act,
      leiArticles: act.leiArticles ? JSON.parse(act.leiArticles) : []
    };

    return NextResponse.json({ act: actWithParsedData });

  } catch (error) {
    console.error('Erro ao buscar ato normativo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar ato normativo' },
      { status: 500 }
    );
  }
}
