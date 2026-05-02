import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/admin/pareceres/classify
 *
 * Override manual da classificação `licitacoesContratos` feita pelo Gemini.
 * Preserva o valor original em `licitacoesContratosAi` e marca a origem do
 * override em `licitacoesContratosManualBy/At`.
 *
 * Body: { docId: string, licitacoesContratos: boolean }
 *   ou:  { docId: string, clearOverride: true } pra desfazer e voltar à IA
 */
export const POST = withAdminAuth(async (
  request: NextRequest,
  context?: Record<string, unknown>,
) => {
  try {
    const user = context?.user as { email: string };
    const body = await request.json();
    const docId = String(body.docId || '').trim();
    if (!docId) {
      return NextResponse.json({ error: 'docId obrigatório' }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true, aiClassification: true, category: true },
    });
    if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

    const ai = doc.aiClassification ? safeParseJson(doc.aiClassification) : {};

    if (body.clearOverride) {
      // Restaura a classificação original do Gemini, se existir backup
      if (typeof ai.licitacoesContratosAi === 'boolean') {
        ai.licitacoesContratos = ai.licitacoesContratosAi;
        delete ai.licitacoesContratosAi;
      }
      delete ai.licitacoesContratosManualBy;
      delete ai.licitacoesContratosManualAt;
    } else {
      const newValue = body.licitacoesContratos;
      if (typeof newValue !== 'boolean') {
        return NextResponse.json(
          { error: 'licitacoesContratos deve ser boolean' },
          { status: 400 },
        );
      }
      // Backup do valor da IA na primeira override (não sobrescreve em overrides repetidos)
      if (typeof ai.licitacoesContratosAi !== 'boolean') {
        ai.licitacoesContratosAi = ai.licitacoesContratos ?? null;
      }
      ai.licitacoesContratos = newValue;
      ai.licitacoesContratosManualBy = user.email;
      ai.licitacoesContratosManualAt = new Date().toISOString();
    }

    await prisma.document.update({
      where: { id: docId },
      data: { aiClassification: JSON.stringify(ai) },
    });

    // Invalida ISR das páginas que listam pareceres
    revalidatePath('/base-conhecimento/pareceres');
    revalidatePath('/base-conhecimento');

    return NextResponse.json({ success: true, aiClassification: ai });
  } catch (error) {
    return handleApiError(error);
  }
});

function safeParseJson(s: string): Record<string, unknown> & {
  licitacoesContratos?: boolean;
  licitacoesContratosAi?: boolean | null;
  licitacoesContratosManualBy?: string;
  licitacoesContratosManualAt?: string;
} {
  try { return JSON.parse(s); } catch { return {}; }
}
