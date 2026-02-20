/**
 * TCE-PE Scraper (esqueleto)
 * Tribunal de Contas do Estado de Pernambuco
 * URL: https://www.tce.pe.gov.br
 * Foco: Consultas em tese sobre Lei 14.133/2021
 */
import type { TribunalScraper, TribunalScrapeOptions, TribunalScrapeResult, ScraperHealthStatus } from './index';

class TCEPEScraper implements TribunalScraper {
  code = 'tce-pe';
  name = 'TCE-PE';
  fullName = 'Tribunal de Contas do Estado de Pernambuco';
  type = 'tce' as const;
  hasApi = false;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === 'tce-pe';
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    return { scraperCode: this.code, isHealthy: false, consecutiveFailures: 0, message: 'Scraper ainda nao implementado (esqueleto)' };
  }

  async scrape(_options: TribunalScrapeOptions = {}): Promise<TribunalScrapeResult> {
    console.log(`[${this.code}] Scraper ainda nao implementado (esqueleto)`);
    return { scraperCode: this.code, itemsFound: 0, itemsNew: 0, itemsSkipped: 0, itemsError: 0, errors: ['Scraper nao implementado'], duration: 0 };
  }
}

export const tcePEScraper = new TCEPEScraper();
export default tcePEScraper;
