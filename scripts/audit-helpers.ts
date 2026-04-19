/**
 * Helpers puros do script audit-legislative-acts, extraídos para testabilidade.
 */

export interface SpotCheckRowForFilter {
  id: string;
  verdict: string;
}

/**
 * Verdicts que indicam comparação impossível ou irrelevante — nunca entram em
 * `spotCheckSuspicious`. Atos com esses verdicts são categorizados separadamente
 * no relatório (seção "Não comparáveis") em vez de serem tratados como bug.
 */
const NON_COMPARABLE_VERDICTS: ReadonlySet<string> = new Set([
  'manual',         // scrapeStatus='manual' — conteúdo de origem externa
  'no-scraper',     // host sem handler registrado em findScraperForUrl
  'scrape-failed',  // scraper tentou mas falhou (transiente ou permanente)
  'url-dead',       // fetch HTTP falhou
  'skipped',        // spot-check pulou por outra razão
]);

/**
 * Filtra linhas do spotCheck que devem aparecer em `spotCheckSuspicious`:
 * - verdict é 'truncated' OU 'bloated' (problemas reais de conteúdo)
 * - id NÃO está em manualIds (defesa em profundidade — um ato pode estar em
 *   scrapeStatus='manual' e ter verdict residual antigo)
 * - verdict NÃO é um dos NON_COMPARABLE_VERDICTS
 */
export function filterSuspiciousExcludingManual(
  spotCheck: SpotCheckRowForFilter[],
  manualIds: Set<string>,
): string[] {
  return spotCheck
    .filter((r) => {
      if (manualIds.has(r.id)) return false;
      if (NON_COMPARABLE_VERDICTS.has(r.verdict)) return false;
      return r.verdict === 'truncated' || r.verdict === 'bloated';
    })
    .map((r) => r.id);
}

export type VerdictCompareResult = 'ok' | 'truncated' | 'bloated';

/**
 * Compara conteúdo armazenado vs conteúdo fresco (extraído pelo MESMO scraper
 * de produção). Apples-to-apples, diferente do heurístico antigo que usava
 * stripHtml naive.
 *
 * Thresholds:
 * - stored < 0.6 × fresh  → 'truncated' (stored perdeu conteúdo real)
 * - stored > 1.4 × fresh  → 'bloated'   (stored tem ruído que o scraper atual remove)
 * - otherwise             → 'ok'
 *
 * Casos de borda:
 * - fresh === 0: retorna 'truncated' (deveríamos ter conteúdo; scraper fresco devolveu vazio é anomalia)
 * - stored === 0 e fresh > 0: retorna 'truncated'
 * - stored === 0 e fresh === 0: retorna 'ok' (ambos vazios, consistente — raro)
 */
export function computeVerdictByCompare(storedLen: number, freshLen: number): VerdictCompareResult {
  if (freshLen === 0) {
    return storedLen === 0 ? 'ok' : 'truncated';
  }
  const ratio = storedLen / freshLen;
  if (ratio < 0.6) return 'truncated';
  if (ratio > 1.4) return 'bloated';
  return 'ok';
}
