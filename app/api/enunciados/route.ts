import { NextRequest, NextResponse } from 'next/server';
import { ENUNCIADOS, getEnunciadosPorArtigo, getEnunciadosPorOrgao, buscarEnunciados, ENUNCIADOS_METADATA } from '@/data/enunciados';

/**
 * GET /api/enunciados
 *
 * Query params:
 * - artigo: Busca enunciados vinculados a um artigo específico
 * - orgao: Filtra por órgão (INCP, CJF, IBDA)
 * - q: Busca textual
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const artigo = searchParams.get('artigo');
    const orgao = searchParams.get('orgao') as 'INCP' | 'CJF' | 'IBDA' | null;
    const query = searchParams.get('q');

    let enunciados = ENUNCIADOS;

    // Filtrar por artigo
    if (artigo) {
      enunciados = getEnunciadosPorArtigo(artigo);
    }

    // Filtrar por órgão
    if (orgao && ['INCP', 'CJF', 'IBDA'].includes(orgao)) {
      enunciados = orgao ? getEnunciadosPorOrgao(orgao) : enunciados;
    }

    // Busca textual
    if (query && query.length >= 3) {
      enunciados = buscarEnunciados(query);
    }

    return NextResponse.json({
      enunciados,
      total: enunciados.length,
      metadata: ENUNCIADOS_METADATA
    });

  } catch (error) {
    console.error('[Enunciados API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar enunciados' },
      { status: 500 }
    );
  }
}
