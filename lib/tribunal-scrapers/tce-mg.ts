/**
 * TCE-MG Scraper
 *
 * Tribunal de Contas do Estado de Minas Gerais
 * URL: https://tcjuris.tce.mg.gov.br/
 *
 * Busca decisoes de jurisprudencia sobre licitacoes e contratos.
 * O sistema TCJuris 2.0 e uma aplicacao ASP.NET MVC com busca estruturada.
 * Nota: O TCJuris pode usar AJAX para carregar resultados de busca,
 * o que pode limitar a eficacia do scraping HTML direto.
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

const SCRAPER_CODE = 'tce-mg';
const BASE_URL = 'https://tcjuris.tce.mg.gov.br';

// ===========================
// Types
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
// TCE-MG Scraper Implementation
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
    try {
      const response = await fetchWithRetry(BASE_URL, { timeoutMs: 15000, maxRetries: 1 });
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

      for (const term of searchTerms) {
        if (allDecisions.length >= maxItems) break;

        try {
          const decisions = await this.searchDecisions(term, maxItems - allDecisions.length);
          allDecisions.push(...decisions);
          await sleep(2000);
        } catch (error) {
          const msg = `Search failed for "${term}": ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(msg);
          console.error(`[${SCRAPER_CODE}]`, msg);
        }
      }

      // Dedup
      const seen = new Set<string>();
      const unique = allDecisions.filter(d => {
        const key = normalizeDecisionNumber(d.decisionNumber);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      result.itemsFound = unique.length;

      for (const raw of unique.slice(0, maxItems)) {
        try {
          await this.processDecision(raw, result, forceRescrape);
        } catch (error) {
          result.itemsError++;
          result.errors.push(
            `Error processing ${raw.decisionNumber}: ${error instanceof Error ? error.message : String(error)}`
          );
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
  // Search
  // ===========================

  private async searchDecisions(term: string, limit: number): Promise<RawDecision[]> {
    // TCJuris 2.0 - try multiple endpoint patterns
    const searchUrls = [
      `${BASE_URL}/Home/Index?texto=${encodeURIComponent(term)}`,
      `${BASE_URL}/Home/Pesquisar?texto=${encodeURIComponent(term)}`,
      `${BASE_URL}/?texto=${encodeURIComponent(term)}`,
    ];

    for (const searchUrl of searchUrls) {
      try {
        const response = await rateLimitedFetch(searchUrl, {}, 1500);
        if (!response.ok) continue;
        const html = await response.text();
        const results = this.parseSearchResults(html, limit);
        if (results.length > 0) return results;
      } catch {
        continue;
      }
    }

    console.warn(`[${SCRAPER_CODE}] All search URLs failed for "${term}"`);
    return [];
  }

  // ===========================
  // Parse HTML results
  // ===========================

  private parseSearchResults(html: string, limit: number): RawDecision[] {
    const $ = cheerio.load(html);
    const decisions: RawDecision[] = [];

    const selectors = [
      // TCJuris ASP.NET MVC patterns
      '.resultado-pesquisa .item',
      '.resultado-pesquisa .registro',
      '#resultados .registro',
      '#resultados .item-resultado',
      // Bootstrap patterns (common in ASP.NET MVC)
      '.panel-default .panel-body',
      '.list-group .list-group-item',
      '.well',
      // Table patterns
      'table.table tbody tr',
      'table.tabela-resultado tbody tr',
      // Generic
      '.conteudo .item-resultado',
      '.search-results .result-item',
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
      // Fallback: links to decisions
      $('a[href*="BaixarArquivo"], a[href*="Nota"], a[href*="acordao"], a[href*="decisao"], a[href*="processo"]').each((i, el) => {
        if (decisions.length >= limit) return false;

        const $el = $(el);
        const href = $el.attr('href') || '';
        const text = $el.text().trim();

        if (text.length > 20) {
          decisions.push({
            decisionNumber: this.extractNumber(text),
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

      const title = $el.find('h3 a, h4 a, .titulo a, .panel-title, strong a, a[href*="BaixarArquivo"], a[href*="Nota"]').first().text().trim();
      const ementa = $el.find('.ementa, .resumo, .texto-ementa, .panel-body p, .conteudo-decisao, p').first().text().trim();
      const relator = $el.find('[class*="relator"], .relator, span:contains("Relator"), label:contains("Relator")').next().text().trim() ||
                      $el.find('[class*="relator"]').text().trim().replace(/^Relator:?\s*/i, '') || undefined;
      const orgao = $el.find('[class*="orgao"], [class*="turma"], [class*="camara"]').text().trim() || undefined;
      const data = $el.find('[class*="data"], time, .data-julgamento, span:contains("/")').first().text().trim() || undefined;
      const link = $el.find('a[href*="BaixarArquivo"], a[href*="Nota"], a').first().attr('href') || undefined;
      const processo = $el.find('[class*="processo"], .processo').text().trim() || undefined;

      if (title || ementa) {
        decisions.push({
          decisionNumber: this.extractNumber(title || ementa),
          title: title || ementa.slice(0, 200),
          ementa: ementa || title,
          relator,
          orgaoJulgador: orgao,
          dataJulgamento: data,
          url: link ? (link.startsWith('http') ? link : `${BASE_URL}${link}`) : undefined,
          processNumber: processo,
        });
      }
    });

    return decisions;
  }

  private extractNumber(text: string): string {
    const match = text.match(/(ac[oó]rd[aã]o|decis[aã]o|parecer)\s+(?:n[.ºo°]\s*)?(\d[\d.]*\/\d{4})/i);
    if (match) return match[2].replace(/\./g, '');

    const numMatch = text.match(/(\d{1,6}\/\d{4})/);
    if (numMatch) return numMatch[1];

    return `unknown-${text.slice(0, 20).replace(/\W/g, '-')}`;
  }

  // ===========================
  // Process decision
  // ===========================

  private async processDecision(
    raw: RawDecision,
    result: TribunalScrapeResult,
    forceRescrape: boolean
  ): Promise<void> {
    const normalized = normalizeDecisionNumber(raw.decisionNumber);
    const fullIdentifier = buildFullIdentifier(SCRAPER_CODE, 'acordao', normalized);

    const existing = await prisma.tribunalDecision.findUnique({
      where: { fullIdentifier },
    });

    if (existing && !forceRescrape) {
      result.itemsSkipped++;
      return;
    }

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
      sourceApi: 'tce-mg-tcjuris',
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
// Register
// ===========================

const tceMGScraper = new TCEMGScraper();
registerScraper(tceMGScraper);

export { tceMGScraper };
export default tceMGScraper;
