/**
 * Helpers puros do script audit-legislative-acts, extraídos para testabilidade.
 */

export interface SpotCheckRowForFilter {
  id: string;
  verdict: string;
}

/**
 * Filtra linhas do spotCheck que devem aparecer em `spotCheckSuspicious`:
 * - verdict é 'truncated' OU 'bloated'
 * - id NÃO está em manualIds (atos com scrapeStatus='manual' são falso-positivos permanentes)
 */
export function filterSuspiciousExcludingManual(
  spotCheck: SpotCheckRowForFilter[],
  manualIds: Set<string>,
): string[] {
  return spotCheck
    .filter((r) => (r.verdict === 'truncated' || r.verdict === 'bloated') && !manualIds.has(r.id))
    .map((r) => r.id);
}
