/**
 * Lookup dos acórdãos CITANTES de um dossiê (spec §7.1) — usado tanto pela
 * gravação da destilação nova (`persistir-tese.ts`) quanto pelo backfill do
 * passivo (Task 6). Módulo próprio para as duas rotas compartilharem a MESMA
 * regra de descarte: se elas divergissem, a evidência de uma delas ficaria
 * inconsistente com a da outra, e é exatamente essa regra que protege a
 * evidência (spec §7.1 — todo trecho consumível precisa de um caminho para o
 * inteiro teor).
 */
import { prisma } from '../prisma';
import type { DossieUso } from './trechos-de-citacao';

export interface DocCitante {
  id: string;
  acordaoNumero: number | null;
  acordaoAno: number | null;
  tcuOrgaoJulgador: string | null;
  url: string | null;
  tcuLinkPDF: string | null;
}

/**
 * Mapa chave->Document dos acórdãos CITANTES do dossiê, para os trechos
 * carregarem o caminho até o inteiro teor. Uma consulta por destilação.
 */
export async function citantesDoDossie(dossie: DossieUso): Promise<Map<string, DocCitante>> {
  const pares = [...new Set(dossie.trechos.map((t) => t.origemChave))]
    .map((c) => c.split('/'))
    .map(([n, a]) => ({ numero: parseInt(n, 10), ano: parseInt(a, 10) }))
    .filter((p) => Number.isFinite(p.numero) && Number.isFinite(p.ano));
  if (pares.length === 0) return new Map();
  const docs = await prisma.document.findMany({
    where: { OR: pares.map((p) => ({ acordaoNumero: p.numero, acordaoAno: p.ano })) },
    select: { id: true, acordaoNumero: true, acordaoAno: true, tcuOrgaoJulgador: true, url: true, tcuLinkPDF: true },
  });
  return new Map(docs.map((d) => [`${d.acordaoNumero}/${d.acordaoAno}`, d]));
}
