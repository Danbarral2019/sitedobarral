/**
 * TCE-RJ Scraper (esqueleto)
 * Tribunal de Contas do Estado do Rio de Janeiro
 * URL: https://www.tce.rj.gov.br
 * Foco: Consultas em tese sobre Lei 14.133/2021
 */
import type { TribunalScraper, TribunalScrapeOptions, TribunalScrapeResult, ScraperHealthStatus } from './index';

class TCERJScraper implements TribunalScraper {
  code = 'tce-rj';
  name = 'TCE-RJ';
  fullName = 'Tribunal de Contas do Estado do Rio de Janeiro';
  type = 'tce' as const;
  hasApi = false;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === 'tce-rj';
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    return { scraperCode: this.code, isHealthy: false, consecutiveFailures: 0, message: 'Scraper ainda nao implementado (esqueleto)' };
  }

  async scrape(_options: TribunalScrapeOptions = {}): Promise<TribunalScrapeResult> {
    console.log(`[${this.code}] Scraper ainda nao implementado (esqueleto)`);
    return { scraperCode: this.code, itemsFound: 0, itemsNew: 0, itemsSkipped: 0, itemsError: 0, errors: ['Scraper nao implementado'], duration: 0 };
  }
}

export const tceRJScraper = new TCERJScraper();
export default tceRJScraper;
