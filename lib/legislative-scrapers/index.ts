/**
 * Sistema de Scrapers para Atos Normativos
 *
 * Suporta extração de textos legais de múltiplas fontes oficiais:
 * - Planalto (www.planalto.gov.br)
 * - Gov.br Compras (www.gov.br/compras)
 * - IN.gov.br (www.in.gov.br)
 * - AGU (www.agu.gov.br)
 */

import { PlanaltoScraper } from './planalto';
import { GovBrComprasScraper } from './govbr-compras';

/**
 * Resultado de uma operação de scraping
 */
export interface ScraperResult {
  success: boolean;
  content?: string;
  hash?: string;
  error?: string;
  source?: string;
  extractedAt?: Date;
}

/**
 * Interface base para scrapers de legislação
 */
export interface LegislativeScraper {
  /** Nome identificador do scraper */
  name: string;

  /** Verifica se este scraper pode processar a URL fornecida */
  canHandle(url: string): boolean;

  /** Extrai o conteúdo textual da URL */
  scrape(url: string): Promise<ScraperResult>;
}

/**
 * Registro de scrapers disponíveis
 */
const scrapers: LegislativeScraper[] = [
  new PlanaltoScraper(),
  new GovBrComprasScraper(),
];

/**
 * Encontra o scraper apropriado para uma URL
 * @param url - URL do ato normativo
 * @returns O scraper que pode processar a URL ou null
 */
export function findScraperForUrl(url: string): LegislativeScraper | null {
  for (const scraper of scrapers) {
    if (scraper.canHandle(url)) {
      return scraper;
    }
  }
  return null;
}

/**
 * Executa o scraping de uma URL usando o scraper apropriado
 * @param url - URL do ato normativo
 * @returns Resultado do scraping
 */
export async function scrapeUrl(url: string): Promise<ScraperResult> {
  const scraper = findScraperForUrl(url);

  if (!scraper) {
    return {
      success: false,
      error: `Nenhum scraper disponível para a URL: ${url}`,
    };
  }

  try {
    const result = await scraper.scrape(url);
    return {
      ...result,
      source: scraper.name,
      extractedAt: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no scraping',
      source: scraper.name,
    };
  }
}

/**
 * Lista todos os scrapers disponíveis
 */
export function getAvailableScrapers(): string[] {
  return scrapers.map(s => s.name);
}

/**
 * Verifica se uma URL pode ser processada por algum scraper
 */
export function canScrapeUrl(url: string): boolean {
  return findScraperForUrl(url) !== null;
}
