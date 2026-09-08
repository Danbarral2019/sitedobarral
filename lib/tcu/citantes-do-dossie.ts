/**
 * Lookup dos acórdãos CITANTES de um dossiê (spec §7.1) — usado tanto pela
 * gravação da destilação nova (`persistir-tese.ts`) quanto pelo backfill do
 * passivo (Task 6). Módulo próprio para as duas rotas compartilharem a MESMA
 * regra de descarte: se elas divergissem, a evidência de uma delas ficaria
 * inconsistente com a da outra, e é exatamente essa regra que protege a
 * evidência (spec §7.1 — todo trecho consumível precisa de um caminho para o
 * inteiro teor).
 *
 * A resolução é por `Document.id`, NÃO pelo par número+ano. O schema declara a
 * unicidade em `(acordaoNumero, acordaoAno, tcuOrgaoJulgador)`: o mesmo número
 * e ano existem em colegiados diferentes (56/2024 está em Plenário, Primeira e
 * Segunda Câmara), e com `tcuOrgaoJulgador` nulo nem o índice único os separa,
 * porque NULL não conflita em índice único no Postgres. Resolver pela chave
 * escolheria um deles ao acaso — o último de um `findMany` — e a evidência
 * levaria o leitor ao inteiro teor de um acórdão onde o trecho não existe.
 * É o mesmo defeito que a §4 diagnostica no acórdão-líder, do lado do citante.
 */
import { prisma } from '../prisma';
import type { DossieUso, TrechoCitacao } from './trechos-de-citacao';

export interface DocCitante {
  id: string;
  acordaoNumero: number | null;
  acordaoAno: number | null;
  tcuOrgaoJulgador: string | null;
  url: string | null;
  tcuLinkPDF: string | null;
}

export interface LookupCitantes {
  /** Índice canônico: id do `Document` → citante. Sem ambiguidade. */
  porId: Map<string, DocCitante>;
  /**
   * Índice de contingência por "numero/ano", para trechos antigos que ainda
   * não carregam `origemDocumentId`. Ambíguo por construção — ver o cabeçalho.
   */
  porChave: Map<string, DocCitante>;
}

/** Par (numero, ano) de uma chave "numero/ano"; null quando inparseável. */
function parDaChave(chave: string): { numero: number; ano: number } | null {
  const [n, a] = chave.split('/');
  const numero = parseInt(n, 10);
  const ano = parseInt(a, 10);
  return Number.isFinite(numero) && Number.isFinite(ano) ? { numero, ano } : null;
}

/**
 * Resolve o `Document` do citante que escreveu um trecho.
 *
 * Puro, para as duas rotas de gravação aplicarem a mesma preferência: id
 * primeiro; a chave só quando o trecho não trouxer id — caso em que devolver
 * "algum" candidato ainda é melhor que devolver nenhum, porque a alternativa é
 * descartar a evidência inteira.
 */
export function citanteDoTrecho(
  lookup: LookupCitantes,
  trecho: Pick<TrechoCitacao, 'origemChave' | 'origemDocumentId'>,
): DocCitante | null {
  if (trecho.origemDocumentId) return lookup.porId.get(trecho.origemDocumentId) ?? null;
  return lookup.porChave.get(trecho.origemChave) ?? null;
}

/**
 * Índices id->Document e chave->Document dos acórdãos CITANTES do dossiê, para
 * os trechos carregarem o caminho até o inteiro teor. Uma consulta por
 * destilação.
 */
export async function citantesDoDossie(dossie: DossieUso): Promise<LookupCitantes> {
  const ids = [...new Set(dossie.trechos.map((t) => t.origemDocumentId).filter((id): id is string => !!id))];
  const pares = [...new Set(dossie.trechos.filter((t) => !t.origemDocumentId).map((t) => t.origemChave))]
    .map(parDaChave)
    .filter((p): p is { numero: number; ano: number } => p !== null);

  if (ids.length === 0 && pares.length === 0) return { porId: new Map(), porChave: new Map() };

  const docs = await prisma.document.findMany({
    where: {
      OR: [
        ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
        ...pares.map((p) => ({ acordaoNumero: p.numero, acordaoAno: p.ano })),
      ],
    },
    select: { id: true, acordaoNumero: true, acordaoAno: true, tcuOrgaoJulgador: true, url: true, tcuLinkPDF: true },
    // Ordem estável só para o índice de contingência: com vários Document no
    // mesmo par número+ano, qual sobrevive não pode variar entre execuções.
    orderBy: { id: 'asc' },
  });

  const porId = new Map(docs.map((d) => [d.id, d]));
  const porChave = new Map<string, DocCitante>();
  for (const d of docs) {
    const k = `${d.acordaoNumero}/${d.acordaoAno}`;
    // Primeiro vence (o `findMany` já vem ordenado por id) — o `Map` nu ficava
    // com o último, e o último de uma consulta sem `orderBy` é indefinido.
    if (!porChave.has(k)) porChave.set(k, d);
  }
  return { porId, porChave };
}
