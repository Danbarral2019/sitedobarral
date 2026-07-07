/**
 * Campos de um documento que podem servir de texto-fonte para indexação.
 */
export interface SourceTextFields {
  content?: string | null;
  tcuEmentaCompleta?: string | null;
  description?: string | null;
}

/**
 * Seleciona o texto-fonte de um documento sem arquivo R2, por ordem de prioridade:
 *   1. content            — texto integral real, quando existe
 *   2. tcuEmentaCompleta  — ementa OFICIAL do TCU (acórdãos captados pelo clipping)
 *   3. description        — resumo executivo gerado por IA (fallback)
 *
 * Preferir a ementa oficial ao resumo-IA cumpre a regra de "fonte com ementa"
 * (não indexar jurisprudência por texto derivado). Retorna '' se nenhum candidato
 * tiver conteúdo útil (após trim).
 */
export function selectSourceText(doc: SourceTextFields): string {
  const candidates = [doc.content, doc.tcuEmentaCompleta, doc.description];
  for (const c of candidates) {
    if (c && c.trim().length > 0) return c;
  }
  return '';
}
