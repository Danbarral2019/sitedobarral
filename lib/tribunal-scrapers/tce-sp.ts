/**
 * TCE-SP Scraper
 *
 * Tribunal de Contas do Estado de Sao Paulo
 * URL: https://www4.tce.sp.gov.br/pesquisa-de-jurisprudencia
 *
 * Busca decisoes relacionadas a licitacoes e contratos administrativos.
 * Tenta API REST primeiro; fallback para scraping HTML com cheerio.
 */

import * as cheerio from 'cheerio';
import { prisma } from '@/lib/prisma';
import {
  TribunalScraper,
  TribunalScrapeOptions,
  TribunalScrapeResult,
  ScraperHealthStatus,
  registerScraper,
  DEFAULT_SEARCH_TERMS,
} from './index';
import {
  fetchWithRetry,
  rateLimitedFetch,
  normalizeDecisionNumber,
  buildFullIdentifier,
  extractYear,
  parseBRDate,
  logScraperHealth,
  sleep,
} from './utils';
import { classifyDecision } from './classifier';

// ===========================
// Constants
// ===========================

const SCRAPER_CODE = 'tce-sp';
const BASE_URL = 'https://www4.tce.sp.gov.br';
const _SEARCH_URL = `${BASE_URL}/pesquisa-de-jurisprudencia`;

// ===========================
// Types for parsed results
// ===========================

interface RawDecision {
  decisionNumber: string;
  title: string;
  ementa: string;
  relator?: string;
  orgaoJulgador?: string;
  dataJulgamento?: string;
  url?: string;
  processNumber?: string;
}

// ===========================
// TCE-SP Scraper Implementation
// ===========================

class TCESPScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCE-SP';
  fullName = 'Tribunal de Contas do Estado de Sao Paulo';
  type = 'tce' as const;
  hasApi = false;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const response = await fetchWithRetry(`${BASE_URL}/pesquisa-de-jurisprudencia`, { timeoutMs: 15000, maxRetries: 1 });
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
        message: response.ok ? 'Site acessivel' : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        scraperCode: SCRAPER_CODE,
        isHealthy: false,
        consecutiveFailures: 1,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async scrape(options: TribunalScrapeOptions = {}): Promise<TribunalScrapeResult> {
    const startTime = Date.now();
    const {
      maxItems = 100,
      searchTerms = DEFAULT_SEARCH_TERMS,
      forceRescrape = false,
    } = options;

    const result: TribunalScrapeResult = {
      scraperCode: SCRAPER_CODE,
      itemsFound: 0,
      itemsNew: 0,
      itemsSkipped: 0,
      itemsError: 0,
      errors: [],
      duration: 0,
    };

    try {
      const allDecisions: RawDecision[] = [];

      // Search for each term
      for (const term of searchTerms) {
        if (allDecisions.length >= maxItems) break;

        try {
          const decisions = await this.searchDecisions(term, maxItems - allDecisions.length);
          allDecisions.push(...decisions);
          await sleep(2000); // Rate limit between searches
        } catch (error) {
          const msg = `Search failed for "${term}": ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(msg);
          console.error(`[${SCRAPER_CODE}]`, msg);
        }
      }

      // Deduplicate by decision number
      const seen = new Set<string>();
      const uniqueDecisions = allDecisions.filter(d => {
        const key = normalizeDecisionNumber(d.decisionNumber);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      result.itemsFound = uniqueDecisions.length;

      // Process each decision
      for (const raw of uniqueDecisions.slice(0, maxItems)) {
        try {
          await this.processDecision(raw, result, forceRescrape);
        } catch (error) {
          result.itemsError++;
          const msg = `Error processing ${raw.decisionNumber}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(msg);
          console.error(`[${SCRAPER_CODE}]`, msg);
        }
      }

      result.duration = Date.now() - startTime;
      await logScraperHealth(SCRAPER_CODE, result.errors.length > 0 ? 'partial_failure' : 'success', {
        itemsFound: result.itemsFound,
        itemsNew: result.itemsNew,
        itemsError: result.itemsError,
        duration: result.duration,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      });
    } catch (error) {
      result.duration = Date.now() - startTime;
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(msg);
      await logScraperHealth(SCRAPER_CODE, 'failure', {
        duration: result.duration,
        errorMessage: msg,
      });
    }

    return result;
  }

  // ===========================
  // Search decisions
  // ===========================

  private async searchDecisions(term: string, limit: number): Promise<RawDecision[]> {
    // Try API search first, fallback to HTML scraping
    try {
      return await this.searchViaHTML(term, limit);
    } catch (error) {
      console.warn(`[${SCRAPER_CODE}] HTML search failed for "${term}":`, error);
      return [];
    }
  }

  // ===========================
  // HTML scraping approach
  // ===========================

  private async searchViaHTML(term: string, limit: number): Promise<RawDecision[]> {
    const searchUrl = `${BASE_URL}/resultado-da-pesquisa-jurisprudencia?keys=${encodeURIComponent(term)}`;

    const response = await rateLimitedFetch(searchUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for search: ${term}`);
    }

    const html = await response.text();
    return this.parseSearchResults(html, limit);
  }

  // ===========================
  // Parse search result page
  // ===========================

  private parseSearchResults(html: string, limit: number): RawDecision[] {
    const $ = cheerio.load(html);
    const decisions: RawDecision[] = [];

    // Try common patterns for search results
    const selectors = [
      // Drupal views patterns (TCE-SP uses Drupal with Search API Solr)
      '.view-content .views-row',
      '.view-content article',
      '.view-content .node',
      '.search-results .search-result',
      '.search-results li',
      // Generic fallbacks
      '.resultado-item',
      '.list-group-item',
      'table.resultado tbody tr',
    ];

    let $items: cheerio.Cheerio | null = null;
    for (const selector of selectors) {
      const found = $(selector);
      if (found.length > 0) {
        $items = found;
        break;
      }
    }

    if (!$items || $items.length === 0) {
      // Fallback: try to extract from any structured content
      $('a[href*="jurisprudencia"], a[href*="acordao"], a[href*="decisao"]').each((i, el) => {
        if (decisions.length >= limit) return false;

        const $el = $(el);
        const href = $el.attr('href') || '';
        const text = $el.text().trim();

        if (text.length > 20) {
          decisions.push({
            decisionNumber: this.extractDecisionNumberFromText(text),
            title: text.slice(0, 200),
            ementa: text,
            url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
          });
        }
      });

      return decisions;
    }

    $items.each((i, el) => {
      if (decisions.length >= limit) return false;

      const $el = $(el);

      // Extract decision data (Drupal-compatible selectors)
      const title = $el.find('h3 a, h2 a, .views-field-title a, .field--name-title a, .title a').first().text().trim();
      const ementa = $el.find('.views-field-body, .field--name-body, .field--name-field-ementa, .ementa, p.summary, .search-snippet').first().text().trim();
      const relator = $el.find('.views-field-field-relator, .field--name-field-relator, [class*="relator"]').text().trim() || undefined;
      const orgao = $el.find('.views-field-field-orgao, .field--name-field-orgao, [class*="orgao"], [class*="camara"]').text().trim() || undefined;
      const data = $el.find('.views-field-field-data, .field--name-field-data, .date-display-single, time, [class*="data"]').text().trim() || undefined;
      const link = $el.find('a').first().attr('href') || undefined;
      const processo = $el.find('.views-field-field-processo, .field--name-field-processo, [class*="processo"]').text().trim() || undefined;

      if (title || ementa) {
        const decisionNumber = this.extractDecisionNumberFromText(title || ementa);
        decisions.push({
          decisionNumber,
          title: title || ementa.slice(0, 200),
          ementa: ementa || title,
          relator: relator || undefined,
          orgaoJulgador: orgao || undefined,
          dataJulgamento: data || undefined,
          url: link ? (link.startsWith('http') ? link : `${BASE_URL}${link}`) : undefined,
          processNumber: processo || undefined,
        });
      }
    });

    return decisions;
  }

  // ===========================
  // Extract decision number from text
  // ===========================

  private extractDecisionNumberFromText(text: string): string {
    // Pattern: "Acordao 1234/2024" or "Decisao 5678/2023"
    const match = text.match(/(ac[oó]rd[aã]o|decis[aã]o|parecer)\s+(?:n[.ºo°]\s*)?(\d[\d.]*\/\d{4})/i);
    if (match) return match[2].replace(/\./g, '');

    // Pattern: just a number/year
    const numMatch = text.match(/(\d{1,6}\/\d{4})/);
    if (numMatch) return numMatch[1];

    // Fallback: use hash of text
    return `unknown-${text.slice(0, 20).replace(/\W/g, '-')}`;
  }

  // ===========================
  // Process and save a decision
  // ===========================

  private async processDecision(
    raw: RawDecision,
    result: TribunalScrapeResult,
    forceRescrape: boolean
  ): Promise<void> {
    const normalized = normalizeDecisionNumber(raw.decisionNumber);
    const fullIdentifier = buildFullIdentifier(SCRAPER_CODE, 'acordao', normalized);

    // Check if already exists
    const existing = await prisma.tribunalDecision.findUnique({
      where: { fullIdentifier },
    });

    if (existing && !forceRescrape) {
      result.itemsSkipped++;
      return;
    }

    // Classify
    const classification = await classifyDecision({
      title: raw.title,
      ementa: raw.ementa,
    });

    const year = extractYear(normalized);
    const dataJulgamento = raw.dataJulgamento ? parseBRDate(raw.dataJulgamento) : null;

    const data = {
      tribunalCode: SCRAPER_CODE,
      tribunalName: this.fullName,
      decisionType: 'acordao',
      decisionNumber: normalized,
      processNumber: raw.processNumber || null,
      year,
      fullIdentifier,
      title: raw.title,
      ementa: raw.ementa,
      relator: raw.relator || null,
      orgaoJulgador: raw.orgaoJulgador || null,
      dataJulgamento,
      url: raw.url || null,
      isRelevant: classification.approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      leiArticles: JSON.stringify(classification.leiArticles),
      suggestedCourses: classification.suggestedCourses,
      sourceApi: 'tce-sp-web',
      approvalStatus: classification.approvalStatus,
      confidence: classification.confidence,
      classificationReasoning: classification.reasoning,
    };

    if (existing) {
      await prisma.tribunalDecision.update({
        where: { fullIdentifier },
        data,
      });
    } else {
      await prisma.tribunalDecision.create({ data });
      result.itemsNew++;
    }
  }
}

// ===========================
// Register scraper
// ===========================

const tceSPScraper = new TCESPScraper();
registerScraper(tceSPScraper);

export { tceSPScraper };
export default tceSPScraper;
