import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { buscarCompartilhamento } from '@/lib/search/historico-da-busca';

// GET /api/search-history/share/[shareId] - Buscar resposta compartilhada (público)
// Só o formato novo de shareId (22 caracteres) e só respostas gravadas pelo
// servidor; links antigos de 8 caracteres respondem 404.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    // Endpoint público: limita tentativas de adivinhar shareId
    await enforceRateLimit(`search-share:${getClientIp(request)}`, 30, 60);

    const { shareId } = await params;

    const entry = await buscarCompartilhamento(shareId);
    if (!entry) {
      throw new NotFoundError('Resposta compartilhada');
    }

    return NextResponse.json(entry);
  } catch (error) {
    return handleApiError(error);
  }
}
