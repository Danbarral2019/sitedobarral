/**
 * TCE-MG Scraper — DESABILITADO
 *
 * Tribunal de Contas do Estado de Minas Gerais
 * URL: https://tcjuris.tce.mg.gov.br/
 *
 * NOTA: O site tcjuris.tce.mg.gov.br esta completamente fora do ar / inacessivel
 * desde fevereiro de 2026. Este scraper foi desabilitado para evitar erros e
 * timeouts desnecessarios. O healthCheck sempre retorna isHealthy: false e o
 * scrape() retorna imediatamente com 0 itens.
 *
 * A classe permanece registrada para aparecer no monitoramento de saude como
 * "unhealthy", sinalizando que o tribunal esta indisponivel.
 *
 * Quando o site voltar ao ar, remover as marcacoes de desabilitado e restaurar
 * a logica original de scraping.
 */

import {
  TribunalScraper,
  TribunalScrapeOptions,
  TribunalScrapeResult,
  ScraperHealthStatus,
  registerScraper,
} from './index';
import {
  logScraperHealth,
} from './utils';

// ===========================
// Constants
// ===========================

const SCRAPER_CODE = 'tce-mg';
const DISABLED_MESSAGE = 'Site tcjuris.tce.mg.gov.br indisponivel - scraper desabilitado';

// ===========================
// TCE-MG Scraper Implementation (DESABILITADO)
// ===========================

class TCEMGScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCE-MG';
  fullName = 'Tribunal de Contas do Estado de Minas Gerais';
  type = 'tce' as const;
  hasApi = false;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    return {
      scraperCode: SCRAPER_CODE,
      isHealthy: false,
      consecutiveFailures: 1,
      message: DISABLED_MESSAGE,
    };
  }

  async scrape(_options: TribunalScrapeOptions = {}): Promise<TribunalScrapeResult> {
    const result: TribunalScrapeResult = {
      scraperCode: SCRAPER_CODE,
      itemsFound: 0,
      itemsNew: 0,
      itemsSkipped: 0,
      itemsError: 0,
      errors: [DISABLED_MESSAGE],
      duration: 0,
    };

    await logScraperHealth(SCRAPER_CODE, 'failure', {
      duration: 0,
      errorMessage: DISABLED_MESSAGE,
    });

    return result;
  }
}

// ===========================
// Register
// ===========================

const tceMGScraper = new TCEMGScraper();
registerScraper(tceMGScraper);

export { tceMGScraper };
export default tceMGScraper;
