/**
 * Política da base de conhecimento: NENHUM documento pode ter seu texto
 * reescrito por IA na exibição ao aluno.
 *
 * Motivo: a base contém fontes oficiais (enunciados, súmulas, acórdãos, ONs,
 * pareceres, artigos da lei) e curadoria didática manual do prof. Barral.
 * Reescritas IA introduzem alucinações (incidente IBDA 29: enunciados com
 * temas/artigos completamente trocados pelo Claude) e desfiguram tanto a
 * fonte quanto a curadoria.
 *
 * O que esta proteção faz:
 * - UI nunca exibe `Document.summary` nem `Document.summaryHighlights`
 *   (campos populados por IA via /api/admin/documents/[id]/generate-summary)
 * - O endpoint de geração de summary IA é bloqueado (HTTP 422)
 * - `lib/summary-generator.ts` recusa qualquer chamada (defesa em profundidade)
 *
 * O que NÃO é afetado:
 * - `Document.description` — texto-fonte ou curadoria, exibido na íntegra
 * - `DocumentNotes.keyPoints` / `practicalUse` / `publicNotes` — admin-authored,
 *   continuam visíveis como antes
 * - Resumos pedagógicos manuais (ex: TribunalDecision.summary, LegislativeAct.summary)
 *   ficam fora deste arquivo (têm fluxos próprios de curadoria)
 */

/** A política é universal — qualquer categoria é tratada como fonte literal. */
export function isLiteralSourceCategory(category: string | null | undefined): boolean {
  // Mantemos a função (em vez de inlinar `true`) para que, se no futuro a
  // política precisar de exceções, exista um único ponto de mudança.
  void category;
  return true;
}
