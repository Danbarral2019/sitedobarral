/**
 * TCE-SC Scraper (esqueleto)
 * Tribunal de Contas do Estado de Santa Catarina
 * URL: https://www.tce.sc.gov.br
 * Foco: Consultas em tese sobre Lei 14.133/2021
 */
import type { TribunalScraper, TribunalScrapeOptions, TribunalScrapeResult, ScraperHealthStatus } from './index';

class TCESCScraper implements TribunalScraper {
  code = 'tce-sc';
  name = 'TCE-SC';
  fullName = 'Tribunal de Contas do Estado de Santa Catarina';
  type = 'tce' as const;
  hasApi = false;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === 'tce-sc';
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    return { scraperCode: this.code, isHealthy: false, consecutiveFailures: 0, message: 'Scraper ainda nao implementado (esqueleto)' };
  }

  async scrape(_options: TribunalScrapeOptions = {}): Promise<TribunalScrapeResult> {
    console.log(`[${this.code}] Scraper ainda nao implementado (esqueleto)`);
    return { scraperCode: this.code, itemsFound: 0, itemsNew: 0, itemsSkipped: 0, itemsError: 0, errors: ['Scraper nao implementado'], duration: 0 };
  }
}

export const tceSCScraper = new TCESCScraper();
export default tceSCScraper;
