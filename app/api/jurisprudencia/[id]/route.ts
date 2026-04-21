import { NextRequest, NextResponse } from 'next/server';
import { fetchUnifiedById } from '@/lib/jurisprudencia/unified-query';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';

/**
 * GET /api/jurisprudencia/[id]
 * Detalhes de uma decisão — aceita IDs de TribunalDecision e de Document TCU.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const decision = await fetchUnifiedById(id);

    if (!decision) {
      throw new NotFoundError('Decisão não encontrada');
    }

    return NextResponse.json(decision);
  } catch (error) {
    return handleApiError(error);
  }
}
