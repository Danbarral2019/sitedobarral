/**
 * Categorias de `Document` que existem apenas como substrato interno de busca
 * e nunca devem aparecer ao usuário como "documento".
 *
 * `lei-artigo`: ~183 registros criados por `scripts/index-lei-artigos.ts`, um por
 * artigo da Lei 14.133, para dar corpo semântico ao retrieval. Não são documentos
 * — são o texto da própria lei. Exibi-los na Lei 14.133 Comentada faz o artigo
 * aparecer como "documento vinculado a si mesmo", que foi exatamente o que o
 * Daniel encontrou na aba "Outros Documentos" do art. 1º (auditoria 2026-07-15).
 *
 * Esta constante existe porque a regra estava duplicada e divergente em quatro
 * superfícies — `content-tree`, `answerContext`, `hybrid-search` e (faltando)
 * `article-docs`. Ao adicionar uma categoria-substrato nova, adicione aqui.
 *
 * Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
 */
export const INTERNAL_ONLY_CATEGORIES = ['lei-artigo'] as const;

export type InternalOnlyCategory = (typeof INTERNAL_ONLY_CATEGORIES)[number];

export function isInternalOnlyCategory(category: string | null | undefined): boolean {
  return !!category && (INTERNAL_ONLY_CATEGORIES as readonly string[]).includes(category);
}
