/**
 * Campos de um documento que podem servir de texto-fonte para indexação.
 */
export interface SourceTextFields {
  tcuTextoCompleto?: string | null;
  content?: string | null;
  tcuEmentaCompleta?: string | null;
  description?: string | null;
}

/**
 * Seleciona o texto-fonte de um documento sem arquivo R2, por ordem de prioridade:
 *   1. tcuTextoCompleto   — inteiro teor do acórdão, catalogado por catalog-tcu-inteiro-teor
 *   2. content            — texto integral real, quando existe
 *   3. tcuEmentaCompleta  — ementa OFICIAL do TCU (acórdãos captados pelo clipping)
 *   4. description        — resumo executivo gerado por IA (fallback)
 *
 * O inteiro teor entra na frente desde 09/2026: até então ele era gravado por
 * catalogar-acordao.ts mas NÃO era candidato aqui, então a busca semântica via
 * apenas a ementa — 1 chunk de ~600 chars para acórdãos de ~68 mil. Voto e
 * fundamentação, que é o que o usuário pesquisa, ficavam fora do índice.
 *
 * Preferir a ementa oficial ao resumo-IA cumpre a regra de "fonte com ementa"
 * (não indexar jurisprudência por texto derivado). Retorna '' se nenhum candidato
 * tiver conteúdo útil (após trim).
 */
export function selectSourceText(doc: SourceTextFields): string {
  const candidates = [
    doc.tcuTextoCompleto,
    doc.content,
    doc.tcuEmentaCompleta,
    doc.description,
  ];
  for (const c of candidates) {
    if (c && c.trim().length > 0) return c;
  }
  return '';
}
