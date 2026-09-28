/**
 * Indexação de uma tese para a busca semântica (spec §9).
 *
 * A elegibilidade é conferida AQUI, antes de gastar embedding, com o mesmo
 * predicado dos outros três consumidores. O ramo SQL da busca repete a parte
 * grosseira; a integralidade da evidência não cabe em SQL e é este gate que a
 * garante — um chunk só existe para enunciado íntegro.
 */
import { prisma } from '@/lib/prisma';
import { generateBatchEmbeddings, embeddingToSql } from './gemini-embeddings';
import { evidenciaIntegral } from '@/lib/tcu/elegibilidade-tese';
import { textoEmbeddavel } from './tese-texto';
import { apiLogger } from '@/lib/logger';

export interface ResultadoTese {
  success: boolean;
  enunciadoId: string;
  error?: string;
  stats?: { chunkCount: number; processingTime: number };
}

export async function processTeseEnunciado(enunciadoId: string): Promise<ResultadoTese> {
  const inicio = Date.now();

  try {
    const e = await prisma.teseEnunciado.findUnique({
      where: { id: enunciadoId },
      select: {
        id: true,
        enunciado: true,
        veredito: true,
        retiradoEm: true,
        trechosFonte: true,
        trechos: {
          select: { ordem: true, origemDocumentId: true, origemUrl: true, origemLinkPDF: true },
        },
        destilacao: {
          select: {
            atual: true,
            assunto: true,
            numeroAlvo: true,
            anoAlvo: true,
            colegiadoAlvo: true,
            acordaoKey: true,
            origemIdentidade: true,
          },
        },
      },
    });

    if (!e) return { success: false, enunciadoId, error: 'Enunciado não encontrado' };

    const elegivel =
      e.veredito === 'fiel' &&
      e.retiradoEm === null &&
      e.destilacao.atual &&
      e.trechos.length > 0 &&
      evidenciaIntegral({ trechosFonte: e.trechosFonte, trechos: e.trechos });

    if (!elegivel) {
      await prisma.teseEnunciado.update({
        where: { id: enunciadoId },
        data: { embeddingStatus: 'skipped' },
      });
      return { success: false, enunciadoId, error: 'Enunciado inelegível (spec §6)' };
    }

    const conteudo = textoEmbeddavel({
      enunciado: e.enunciado,
      assunto: e.destilacao.assunto,
      numeroAlvo: e.destilacao.numeroAlvo,
      anoAlvo: e.destilacao.anoAlvo,
      colegiadoAlvo: e.destilacao.colegiadoAlvo,
      acordaoKey: e.destilacao.acordaoKey,
      origemIdentidade: e.destilacao.origemIdentidade,
    });

    const { embeddings } = await generateBatchEmbeddings([conteudo]);
    const vetor = embeddingToSql(embeddings[0]);

    // Upsert pela coluna @unique: reindexar reescreve a mesma linha em vez de
    // acumular chunk órfão, que continuaria sendo recuperado e citado.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TeseEnunciadoChunk" (id, "enunciadoId", content, embedding, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, '${vetor}'::vector, NOW(), NOW())
       ON CONFLICT ("enunciadoId") DO UPDATE
       SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, "updatedAt" = NOW()`,
      enunciadoId,
      conteudo,
    );

    await prisma.teseEnunciado.update({
      where: { id: enunciadoId },
      data: { embeddingStatus: 'completed' },
    });

    return {
      success: true,
      enunciadoId,
      stats: { chunkCount: 1, processingTime: Date.now() - inicio },
    };
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro);
    apiLogger.error({ enunciadoId, erro: msg }, 'falha ao indexar tese');
    await prisma.teseEnunciado
      .update({ where: { id: enunciadoId }, data: { embeddingStatus: 'failed' } })
      .catch(() => {});
    return { success: false, enunciadoId, error: msg };
  }
}
