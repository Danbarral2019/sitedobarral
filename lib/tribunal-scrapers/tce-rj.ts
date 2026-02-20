/**
 * TCE-RJ Scraper — Stub (Site em Migracao)
 *
 * Tribunal de Contas do Estado do Rio de Janeiro
 * URL: https://www.tcerj.tc.br (novo dominio, migrado de tce.rj.gov.br)
 *
 * O site esta em processo de migracao de dominio e o sistema de
 * jurisprudencia esta temporariamente indisponivel.
 * Este scraper verifica o status do site e retorna resultado vazio
 * sem erros fatais. Quando o site voltar, implementar scraping real.
 */

import { prisma } from '@/lib/prisma';
import type {
  TribunalScraper,
  TribunalScrapeOptions,
  TribunalScrapeResult,
  ScraperHealthStatus,
} from './index';
import { fetchWithRetry, logScraperHealth } from './utils';

// ===========================
// Constants
// ===========================

const SCRAPER_CODE = 'tce-rj';
const SITE_URL = 'https://www.tcerj.tc.br';

// ===========================
// TCE-RJ Scraper Implementation
// ===========================

class TCERJScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCE-RJ';
  fullName = 'Tribunal de Contas do Estado do Rio de Janeiro';
  type = 'tce' as const;
  hasApi = false;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const response = await fetchWithRetry(SITE_URL, {
        timeoutMs: 15000,
        maxRetries: 1,
      });

      const lastLog = await prisma.scraperHealthLog.findFirst({
        where: { scraperCode: SCRAPER_CODE },
        orderBy: { runAt: 'desc' },
      });

      return {
        scraperCode: SCRAPER_CODE,
        isHealthy: response.ok,
        lastRun: lastLog?.runAt || undefined,
        lastSuccess: lastLog?.status === 'success' ? lastLog.runAt : undefined,
        consecutiveFailures: lastLog?.status === 'failure' ? 1 : 0,
        message: response.ok
          ? 'Site acessivel (sistema de jurisprudencia em migracao)'
          : `HTTP ${response.status} — site em migracao de dominio`,
      };
    } catch (error) {
      return {
        scraperCode: SCRAPER_CODE,
        isHealthy: false,
        consecutiveFailures: 1,
        message: `Site indisponivel: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async scrape(_options: TribunalScrapeOptions = {}): Promise<TribunalScrapeResult> {
    const startTime = Date.now();

    const result: TribunalScrapeResult = {
      scraperCode: SCRAPER_CODE,
      itemsFound: 0,
      itemsNew: 0,
      itemsSkipped: 0,
      itemsError: 0,
      errors: [],
      duration: 0,
    };

    // Log the attempt but don't treat unavailability as an error
    console.log(`[${SCRAPER_CODE}] Sistema de jurisprudencia em migracao de dominio (tce.rj.gov.br → tcerj.tc.br). Scraping indisponivel.`);

    result.duration = Date.now() - startTime;
    await logScraperHealth(SCRAPER_CODE, 'success', {
      itemsFound: 0,
      itemsNew: 0,
      duration: result.duration,
      metadata: {
        source: 'stub',
        note: 'Site em migracao de dominio. Scraping sera implementado quando o sistema de jurisprudencia estiver disponivel.',
      },
    });

    return result;
  }
}

// ===========================
// Register
// ===========================

const tceRJScraper = new TCERJScraper();

export { tceRJScraper };
export default tceRJScraper;
