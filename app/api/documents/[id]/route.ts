import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await context.params;

    /**
     * `select` explícito, não `include` nem `omit`.
     *
     * Esta rota é pública — a Lei 14.133 Comentada a consome anonimamente —,
     * então a proteção não pode ser exigir login: tem que ser não devolver o
     * que ninguém precisa. Antes, o `include` + spread mandava o model inteiro
     * (~90 colunas) para qualquer chamador: email de admin (`reviewedBy` está
     * preenchido em 2.584 documentos), `r2Key`, `extractedText`, o raciocínio da
     * IA e as mensagens de erro dos pipelines.
     *
     * `select` em vez de `omit` porque é fail-closed: coluna nova no model não
     * vaza por esquecimento — só sai daqui o que for listado. `omit` também não
     * alcança relação aninhada (`notes.adminNotes`, `metaTcu.enriquecimentoErro`).
     *
     * A lista abaixo é a união exata do que os 4 consumidores leem: favoritos,
     * histórico, DocumentDetailModal e LeiDocumentDetails.
     * Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
     */
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        type: true,
        url: true,
        alternativeUrls: true,
        category: true,
        courseId: true,
        tags: true,
        leiArticlesArr: true,
        uploadedAt: true,
        summary: true,
        summaryReviewedByAdmin: true,

        // Identificadores exibidos no cabeçalho do documento
        onNumber: true,
        onYear: true,
        acordaoNumero: true,
        acordaoAno: true,
        entityType: true,
        enunciadoNumber: true,
        issuerOrg: true,
        esfera: true,

        // Fallbacks achatados: a UI lê `notes.X ?? X ?? notesX` (dual-write legado)
        publicNotes: true,
        notesKeyPoints: true,
        notesPracticalUse: true,
        notesImportance: true,

        metaTcu: {
          select: {
            numeroAcordao: true,
            area: true,
            tema: true,
            relator: true,
            orgaoJulgador: true,
            dataJulgamento: true,
          },
        },
        metaDou: {
          select: { url: true, data: true, secao: true, pagina: true, edicao: true },
        },
        // `adminNotes` e `updatedBy` ficam de fora: nenhum consumidor os usa.
        notes: {
          select: { publicNotes: true, practicalUse: true, keyPoints: true, importance: true },
        },
      },
    });

    if (!document) {
      apiLogger.warn({ documentId }, 'Document not found');
      throw new NotFoundError('Documento');
    }

    apiLogger.info({ documentId }, 'Document fetched successfully');

    // Map satellite table notes back to flat names for frontend compatibility.
    // `adminNotes` NÃO é remapeado: é nota interna ("Observações Privadas (Admin)"
    // no Step 4 do wizard) e nenhum consumidor desta rota o exibe.
    const response = {
      ...document,
      publicNotes: document.notes?.publicNotes ?? document.publicNotes,
      keyPoints: document.notes?.keyPoints ?? document.notesKeyPoints,
      practicalUse: document.notes?.practicalUse ?? document.notesPracticalUse,
      importance: document.notes?.importance ?? document.notesImportance,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
