/**
 * Tribunal Scrapers - Interface Principal e Registry
 *
 * Sistema unificado para scraping de decisoes de tribunais de contas.
 * Cada scraper implementa a interface TribunalScraper.
 */

// ===========================
// Interfaces
// ===========================

export interface TribunalScraper {
  code: string;           // "tce-sp"
  name: string;           // "TCE-SP"
  fullName: string;       // "Tribunal de Contas do Estado de Sao Paulo"
  type: 'tce' | 'judicial';
  hasApi: boolean;
  supportsFullText: boolean;
  canHandle(tribunalCode: string): boolean;
  scrape(options: TribunalScrapeOptions): Promise<TribunalScrapeResult>;
  healthCheck(): Promise<ScraperHealthStatus>;
}

export interface TribunalScrapeOptions {
  maxItems?: number;      // Default 100
  startDate?: Date;
  endDate?: Date;
  searchTerms?: string[];
  forceRescrape?: boolean;
}

export interface TribunalScrapeResult {
  scraperCode: string;
  itemsFound: number;
  itemsNew: number;
  itemsSkipped: number;
  itemsError: number;
  errors: string[];
  duration: number;       // ms
}

export interface ScraperHealthStatus {
  scraperCode: string;
  isHealthy: boolean;
  lastRun?: Date;
  lastSuccess?: Date;
  consecutiveFailures: number;
  message?: string;
}

// ===========================
// Scraper Registry
// ===========================

const scraperRegistry: Map<string, TribunalScraper> = new Map();

export function registerScraper(scraper: TribunalScraper): void {
  scraperRegistry.set(scraper.code, scraper);
}

export function getScraper(code: string): TribunalScraper | undefined {
  return scraperRegistry.get(code);
}

export function getAllScrapers(): TribunalScraper[] {
  return Array.from(scraperRegistry.values());
}

export function getScrapersByType(type: 'tce' | 'judicial'): TribunalScraper[] {
  return getAllScrapers().filter(s => s.type === type);
}

// Re-export DEFAULT_SEARCH_TERMS from utils (canonical location)
export { DEFAULT_SEARCH_TERMS } from './utils';

// ===========================
// Register all scrapers
// (imported AFTER registry is initialized — no circular TDZ)
// ===========================

import { tceSPScraper } from './tce-sp';
import { tcePRScraper } from './tce-pr';
import { tceMGScraper } from './tce-mg';

registerScraper(tceSPScraper);
registerScraper(tcePRScraper);
registerScraper(tceMGScraper);
