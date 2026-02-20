/**
 * TCE-RS Scraper (esqueleto)
 * Tribunal de Contas do Estado do Rio Grande do Sul
 * URL: https://www.tce.rs.gov.br
 * Foco: Consultas em tese sobre Lei 14.133/2021
 */
import type { TribunalScraper, TribunalScrapeOptions, TribunalScrapeResult, ScraperHealthStatus } from './index';

class TCERSScraper implements TribunalScraper {
  code = 'tce-rs';
  name = 'TCE-RS';
  fullName = 'Tribunal de Contas do Estado do Rio Grande do Sul';
  type = 'tce' as const;
  hasApi = false;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === 'tce-rs';
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    return { scraperCode: this.code, isHealthy: false, consecutiveFailures: 0, message: 'Scraper ainda nao implementado (esqueleto)' };
  }

  async scrape(_options: TribunalScrapeOptions = {}): Promise<TribunalScrapeResult> {
    console.log(`[${this.code}] Scraper ainda nao implementado (esqueleto)`);
    return { scraperCode: this.code, itemsFound: 0, itemsNew: 0, itemsSkipped: 0, itemsError: 0, errors: ['Scraper nao implementado'], duration: 0 };
  }
}

export const tceRSScraper = new TCERSScraper();
export default tceRSScraper;
