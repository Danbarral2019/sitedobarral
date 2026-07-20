/**
 * Núcleo puro do backfill retroativo de acórdãos do TCU (spec 2026-07-20).
 * Decide o que entra e com quais marcas; não toca rede nem banco.
 *
 * Duas regras não óbvias, ambas medidas:
 * - Acórdão DE RELAÇÃO é 80% do feed e não tem seção de voto (1-6 kB, sem
 *   Relatório/Voto/Acórdão). Como o dossiê de precedentes se alimenta de
 *   trechos NO VOTO, ele é combustível morto e é descartado aqui.
 * - As marcas de invisibilidade (categoria própria, isPublic false,
 *   reviewedBy próprio) existem porque as consultas do site já filtram por
 *   elas. É proteção por construção, não um filtro novo a espalhar.
 */

export interface ItemFeed {
  tipo?: string;
  numeroAcordao?: string;
  anoAcordao?: string;
  titulo?: string;
  sumario?: string;
  colegiado?: string;
  relator?: string;
  dataSessao?: string;
  urlArquivo?: string;
  urlArquivoPDF?: string;
}

export const CATEGORIA_GRAFO = 'acordao-grafo';
export const DATA_ALVO = '2023-12-01';

export function parseDataSessao(d: string | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((d ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function linkRtf(item: ItemFeed): string | null {
  return item.urlArquivoPDF || item.urlArquivo || null;
}

function mapearColegiado(colegiado: string | null | undefined): string {
  const c = (colegiado ?? '').trim();
  if (/1[ªa]\s*c/i.test(c) || /primeira/i.test(c)) return 'Primeira Câmara';
  if (/2[ªa]\s*c/i.test(c) || /segunda/i.test(c)) return 'Segunda Câmara';
  return 'Plenário';
}

// Normaliza o campo `tipo` para comparação: remove acentos (NFD + strip de
// diacríticos), maiuscula e tira espaços nas bordas. Precisa lidar com
// acento e com caixa porque o feed do TCU não é consistente nisso.
function normalizarTipo(tipo: string | undefined): string {
  return (tipo ?? '')
    .normalize('NFD') // separa a letra base da marca de acento (ex.: "Ã" -> "A" + combining tilde)
    .replace(/[̀-ͯ]/g, '') // remove as marcas diacríticas combinantes (acentos)
    .toUpperCase()
    .trim();
}

export function ehAproveitavel(item: ItemFeed): boolean {
  // Whitelist, não blacklist: só ACÓRDÃO (normalizado) entra. O endpoint do
  // TCU tem outros valores de `tipo` além de "Acórdão de Relação" (ver
  // lib/tcu-scraper.ts:21) — uma blacklist de "RELAÇÃO" deixaria passar
  // "Decisão", tipo ausente, ou qualquer valor futuro não previsto.
  // "ACÓRDÃO DE RELAÇÃO" normalizado vira "ACORDAO DE RELACAO", que a
  // igualdade estrita já rejeita.
  if (normalizarTipo(item.tipo) !== 'ACORDAO') return false;
  if (!linkRtf(item)) return false;
  const num = Number(item.numeroAcordao);
  const ano = Number(item.anoAcordao);
  return Number.isFinite(num) && num > 0 && Number.isFinite(ano) && ano > 1990;
}

export function montarDadosDocument(item: ItemFeed): Record<string, unknown> | null {
  if (!ehAproveitavel(item)) return null;
  const num = Number(item.numeroAcordao);
  const ano = Number(item.anoAcordao);
  const colegiado = mapearColegiado(item.colegiado);
  const iso = parseDataSessao(item.dataSessao);

  return {
    title: item.titulo || `ACÓRDÃO ${num}/${ano} - ${colegiado}`,
    description: item.sumario || item.titulo || '',
    url: `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${num}/${ano}/${encodeURIComponent(colegiado)}`,
    type: 'link',
    category: CATEGORIA_GRAFO,
    courseId: null,
    isCommon: false,
    isPublic: false,
    reviewed: true,
    reviewedAt: new Date(),
    reviewedBy: 'backfill-grafo',
    tags: JSON.stringify(['TCU', 'Acórdão', 'grafo', colegiado, `${ano}`]),
    acordaoNumero: num,
    acordaoAno: ano,
    tcuNumeroAcordao: `${num}/${ano}`,
    tcuEmentaCompleta: item.sumario || null,
    tcuRelator: item.relator || null,
    tcuOrgaoJulgador: colegiado,
    tcuLinkPDF: linkRtf(item),
    tcuDataJulgamento: iso ? new Date(`${iso}T00:00:00Z`) : null,
    tcuEnriquecimentoStatus: 'skipped',
    embeddingStatus: 'skipped',
  };
}

export function atingiuAlvo(item: ItemFeed, dataAlvo: string = DATA_ALVO): boolean {
  const iso = parseDataSessao(item.dataSessao);
  return iso !== null && iso < dataAlvo;
}
