/**
 * "Fontes literais" — categorias de documentos cujo `description` é o
 * próprio texto-fonte oficial (citação obrigatória na íntegra). Para essas,
 * a IA NUNCA pode gerar resumos: o risco de alucinação ou paráfrase
 * desfigurar a fonte é grande demais (incidente IBDA 29: enunciados com
 * temas/artigos completamente trocados pelo Claude).
 *
 * Para outras categorias (acórdãos, ONs, súmulas, lei-artigo, etc.),
 * `description` já é uma curadoria didática — IA pode gerar resumos
 * complementares pelo endpoint /api/admin/documents/[id]/generate-summary.
 *
 * O que esta proteção faz para categorias literais:
 * - UI nunca exibe `Document.summary` nem `Document.summaryHighlights`
 * - O endpoint /generate-summary retorna HTTP 422
 * - `lib/summary-generator.ts` recusa qualquer chamada (defesa em profundidade)
 */
export const LITERAL_SOURCE_CATEGORIES = ['enunciados'] as const;

export type LiteralSourceCategory = typeof LITERAL_SOURCE_CATEGORIES[number];

export function isLiteralSourceCategory(category: string | null | undefined): boolean {
  return !!category && (LITERAL_SOURCE_CATEGORIES as readonly string[]).includes(category);
}
