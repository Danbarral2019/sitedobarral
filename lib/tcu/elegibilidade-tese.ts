/**
 * O predicado de elegibilidade das teses, num lugar só (spec §6).
 *
 * Quatro consumidores dependem dele — vitrine, acervo restrito, busca por IA e
 * export:elic. Reescrito à mão em cada um, ele diverge, e a divergência publica
 * tese reprovada, retirada ou sem evidência.
 *
 * ATENÇÃO: `veredito` preenchido NÃO é aprovação. O vocabulário é
 * `fiel | imprecisa | errada` (parsear-veredito.ts) e as duas últimas reprovam.
 */
import type { Prisma } from '@prisma/client';

/**
 * Filtro SQL do predicado base. A integralidade da evidência (todos os índices
 * declarados persistidos) NÃO cabe aqui — depende de comparar contagens contra
 * um campo Json, o que Prisma não expressa. O `some: {}` barra o caso grosseiro
 * (zero trechos); a integralidade é conferida em memória por
 * `evidenciaIntegral`, e todo consumidor precisa aplicar as duas.
 */
export const WHERE_ELEGIVEL_BASE = {
  veredito: 'fiel',
  retiradoEm: null,
  destilacao: { atual: true, acordaoKey: { not: null } },
  trechos: { some: {} },
} satisfies Prisma.TeseEnunciadoWhereInput;

/** Índices distintos e ordenados declarados em `trechosFonte`. */
export function indicesDeclarados(trechosFonte: unknown): number[] {
  if (!Array.isArray(trechosFonte)) return [];
  const validos = trechosFonte.filter(
    (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0,
  );
  return [...new Set(validos)].sort((a, b) => a - b);
}

/**
 * Evidência íntegra: as TRÊS conjunções da spec §6.
 *
 * 1. Ao menos um índice declarado. Não é redundante com a igualdade: um
 *    enunciado que não declara índice nenhum satisfaria `0 === 0` e passaria
 *    como se tivesse fundamentação completa, quando não tem evidência alguma.
 * 2. Todos os índices declarados estão persistidos.
 * 3. Todo trecho persistido tem caminho para o inteiro teor (§7.1).
 *
 * A terceira NÃO é redundante com a guarda da gravação, que roda uma vez e
 * sobre o dado daquele instante. `origemDocument` é `onDelete: SetNull`: um
 * trecho gravado só com `origemDocumentId` — permitido, porque o id sozinho já
 * é um caminho — perde TODOS os caminhos quando o `Document` do citante é
 * apagado. Sem esta cláusula a tese seguiria elegível com evidência que
 * ninguém consegue conferir, e nada detectaria, porque a contagem de índices
 * não mudou. A invariante da §7.1 é de leitura, não só de escrita.
 */
export function evidenciaIntegral(enunciado: {
  trechosFonte: unknown;
  trechos: Array<{
    ordem: number;
    origemDocumentId: string | null;
    origemUrl: string | null;
    origemLinkPDF: string | null;
  }>;
}): boolean {
  const declarados = indicesDeclarados(enunciado.trechosFonte);
  if (declarados.length === 0) return false;
  const persistidos = new Set(enunciado.trechos.map((t) => t.ordem));
  if (persistidos.size !== declarados.length) return false;
  if (!declarados.every((i) => persistidos.has(i))) return false;
  return enunciado.trechos.every((t) => !!(t.origemDocumentId || t.origemUrl || t.origemLinkPDF));
}
