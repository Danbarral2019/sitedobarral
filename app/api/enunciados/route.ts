import { NextRequest, NextResponse } from 'next/server';
import { ENUNCIADOS, getEnunciadosPorArtigo, getEnunciadosPorOrgao, buscarEnunciados, ENUNCIADOS_METADATA } from '@/data/enunciados';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

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

    const result = await withCache(
      CacheKeys.enunciados({ artigo, orgao, query }),
      async () => {
        let enunciados = ENUNCIADOS;

        if (artigo) {
          enunciados = getEnunciadosPorArtigo(artigo);
        }

        if (orgao && ['INCP', 'CJF', 'IBDA'].includes(orgao)) {
          enunciados = orgao ? getEnunciadosPorOrgao(orgao) : enunciados;
        }

        if (query && query.length >= 3) {
          enunciados = buscarEnunciados(query);
        }

        return {
          enunciados,
          total: enunciados.length,
          metadata: ENUNCIADOS_METADATA,
        };
      },
      CACHE_TTL.ENUNCIADOS,
      { prefix: 'enunciados' }
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });

  } catch (error) {
    console.error('[Enunciados API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar enunciados' },
      { status: 500 }
    );
  }
}
