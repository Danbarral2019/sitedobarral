/**
 * A evidência acompanha a tese no contexto da IA (spec §9).
 *
 * A tese é curta, abstrata e escrita em linguagem de súmula: formalmente
 * parecida com uma pergunta, tende a pontuar alto e expulsar os acórdãos do
 * contexto, e a IA passaria a responder pela síntese sem a fonte. A companhia
 * obrigatória da tese é a sua evidência, e não o acórdão-líder: o líder não
 * existe como `Document` em 39 das 93 teses, e a tese não foi extraída dele,
 * mas das manifestações posteriores que o citaram. Quem sustenta a afirmação é
 * o acórdão CITANTE, que é o que `TeseTrechoFonte` guarda.
 *
 * Regra de recuperação complementar, no mecanismo de answerContext.ts:
 *   1. tese recuperada → ao menos um TeseTrechoFonte entra no contexto, sempre,
 *      costurado ao próprio texto da tese; tese sem trecho não entra;
 *   2. com origemDocumentId resolvido, o Document do CITANTE entra junto;
 *   3. a ausência desse Document não bloqueia a tese.
 */
import { prisma } from '@/lib/prisma';
import type { SearchResult } from '@/lib/embeddings/vector-search';

export interface TrechoDeTese {
  enunciadoId: string;
  ordem: number;
  trecho: string;
  origemNumero: number;
  origemAno: number;
  noVoto: boolean;
  origemDocumentId: string | null;
  origemUrl: string | null;
  origemLinkPDF: string | null;
}

/** O primeiro trecho-fonte de cada tese recuperada, e os citantes que existem como Document. */
export async function anexarEvidenciaDasTeses(
  resultados: SearchResult[],
): Promise<{ trechos: TrechoDeTese[]; documentIdsCitantes: string[] }> {
  const idsDeTeses = resultados
    .filter((r) => r.sourceType === 'tese')
    .map((r) => r.documentId);

  if (idsDeTeses.length === 0) return { trechos: [], documentIdsCitantes: [] };

  const trechos = await prisma.teseTrechoFonte.findMany({
    where: { enunciadoId: { in: idsDeTeses } },
    orderBy: [{ enunciadoId: 'asc' }, { ordem: 'asc' }],
    distinct: ['enunciadoId'],
    select: {
      enunciadoId: true,
      ordem: true,
      trecho: true,
      origemNumero: true,
      origemAno: true,
      noVoto: true,
      origemDocumentId: true,
      origemUrl: true,
      origemLinkPDF: true,
    },
  });

  const documentIdsCitantes = [
    ...new Set(trechos.map((t) => t.origemDocumentId).filter((id): id is string => !!id)),
  ];

  return { trechos, documentIdsCitantes };
}

/**
 * Costura o trecho-fonte ao texto de cada tese, e tira do resultado a tese que
 * ficou sem trecho. Os demais resultados passam intactos e na mesma ordem.
 *
 * Costurar, e não acrescentar um item à parte, porque o contexto é cortado por
 * tamanho e reordenado por categoria: um item separado poderia ficar de fora
 * enquanto a tese entra. No mesmo texto, os dois entram ou saem juntos.
 */
export function costurarEvidencia(resultados: SearchResult[], trechos: TrechoDeTese[]): SearchResult[] {
  const porTese = new Map(trechos.map((t) => [t.enunciadoId, t]));
  return resultados.flatMap((r) => {
    if (r.sourceType !== 'tese') return [r];
    const t = porTese.get(r.documentId);
    if (!t) return [];
    const onde = t.noVoto ? 'no voto do' : 'no';
    return [{
      ...r,
      chunkContent:
        `${r.chunkContent}\n\n` +
        `Trecho ${onde} Acórdão ${t.origemNumero}/${t.origemAno} do TCU que sustenta esta tese:\n${t.trecho}`,
    }];
  });
}
