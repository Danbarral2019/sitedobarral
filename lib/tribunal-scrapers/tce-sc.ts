/**
 * TCE-SC Scraper — HTML Scraping (Prejulgados)
 *
 * Tribunal de Contas do Estado de Santa Catarina
 * URL: https://www.tce.sc.gov.br
 *
 * O sistema principal ePapyrus (jurisprudencia.tce.sc.gov.br) e um SPA Angular
 * que requer headless browser. Usamos a pagina de prejulgados que e HTML estatico:
 *   https://www.tce.sc.gov.br/content/prejulgados
 *
 * O TCE-SC tem ~64 prejulgados vigentes sobre temas variados.
 * A filtragem por classifyDecision() garante que so os relevantes
 * para licitacoes sejam salvos.
 */

import * as cheerio from 'cheerio';
import { prisma } from '@/lib/prisma';
import type {
  TribunalScraper,
  TribunalScrapeOptions,
  TribunalScrapeResult,
  ScraperHealthStatus,
} from './index';
import {
  fetchWithRetry,
  normalizeDecisionNumber,
  buildFullIdentifier,
  extractYear,
  logScraperHealth,
} from './utils';
import { classifyDecision } from './classifier';

// ===========================
// Constants
// ===========================

const SCRAPER_CODE = 'tce-sc';
const BASE_URL = 'https://www.tce.sc.gov.br';
const PREJULGADOS_URL = `${BASE_URL}/content/prejulgados`;

// ===========================
// Types
// ===========================

interface RawDecision {
  decisionNumber: string;
  title: string;
  ementa: string;
  url?: string;
}

// ===========================
// TCE-SC Scraper Implementation
// ===========================

class TCESCScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCE-SC';
  fullName = 'Tribunal de Contas do Estado de Santa Catarina';
  type = 'tce' as const;
  hasApi = false;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const response = await fetchWithRetry(PREJULGADOS_URL, {
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
        message: response.ok ? 'Pagina de prejulgados acessivel' : `HTTP ${response.status}`,
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
      const decisions = await this.scrapePrejulgados();

      if (decisions.length === 0) {
        console.log(`[${SCRAPER_CODE}] Nenhum prejulgado encontrado na pagina. Layout pode ter mudado.`);
        result.duration = Date.now() - startTime;
        await logScraperHealth(SCRAPER_CODE, 'success', {
          itemsFound: 0,
          itemsNew: 0,
          duration: result.duration,
          metadata: { source: 'prejulgados-html', note: 'Pagina sem resultados parseados' },
        });
        return result;
      }

      console.log(`[${SCRAPER_CODE}] Parsed ${decisions.length} prejulgados`);
      result.itemsFound = decisions.length;

      for (const raw of decisions.slice(0, maxItems)) {
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
        metadata: { source: 'prejulgados-html' },
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
  // Scrape prejulgados page
  // ===========================

  private async scrapePrejulgados(): Promise<RawDecision[]> {
    const response = await fetchWithRetry(PREJULGADOS_URL, {
      timeoutMs: 30000,
      maxRetries: 2,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${PREJULGADOS_URL}`);
    }

    const html = await response.text();
    return this.parsePrejulgados(html);
  }

  // ===========================
  // Parse prejulgados HTML
  // ===========================

  private parsePrejulgados(html: string): RawDecision[] {
    const $ = cheerio.load(html);
    const decisions: RawDecision[] = [];

    // Strategy 1: Look for structured list items/table rows with prejulgado data
    // The page typically has a list of prejulgados with number + description/ementa

    // Try: links with "Prejulgado" text or numbered list items
    $('a, li, tr, .views-row, .item-list li, .field-content').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();

      // Match patterns like "Prejulgado 1234" or "Prejulgado nº 1234"
      const prejMatch = text.match(/prejulgado\s+(?:n[.ºo°]\s*)?(\d{1,4})/i);
      if (!prejMatch) return;

      const numero = prejMatch[1];
      const decisionNumber = numero;

      // Check if already added
      if (decisions.some(d => d.decisionNumber === decisionNumber)) return;

      // Extract ementa: text after the number, or the full text
      const ementa = text;

      // Try to get link URL
      let url: string | undefined;
      const $link = $el.is('a') ? $el : $el.find('a').first();
      if ($link.length > 0) {
        const href = $link.attr('href');
        if (href) {
          url = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
        }
      }

      decisions.push({
        decisionNumber,
        title: `Prejulgado ${decisionNumber} TCE-SC`,
        ementa: ementa.slice(0, 2000) || `Prejulgado ${decisionNumber}`,
        url,
      });
    });

    // Strategy 2: If no structured elements found, try regex on the full HTML text
    if (decisions.length === 0) {
      const bodyText = $('body').text();
      const regex = /prejulgado\s+(?:n[.ºo°]\s*)?(\d{1,4})\s*[-–:.]?\s*([^\n]{10,200})/gi;
      let match;

      while ((match = regex.exec(bodyText)) !== null) {
        const numero = match[1];
        const ementa = match[2].trim();

        if (!decisions.some(d => d.decisionNumber === numero)) {
          decisions.push({
            decisionNumber: numero,
            title: `Prejulgado ${numero} TCE-SC`,
            ementa: ementa || `Prejulgado ${numero}`,
          });
        }
      }
    }

    return decisions;
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
      decisionType: 'prejulgado',
    });

    const year = extractYear(normalized);

    const data = {
      tribunalCode: SCRAPER_CODE,
      tribunalName: this.fullName,
      decisionType: 'acordao',
      decisionNumber: normalized,
      processNumber: null,
      year,
      fullIdentifier,
      title: raw.title,
      ementa: raw.ementa,
      relator: null,
      orgaoJulgador: null,
      dataJulgamento: null,
      url: raw.url || null,
      isRelevant: classification.approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      leiArticles: JSON.stringify(classification.leiArticles),
      suggestedCourses: classification.suggestedCourses,
      sourceApi: 'tce-sc-prejulgados',
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

const tceSCScraper = new TCESCScraper();

export { tceSCScraper };
export default tceSCScraper;
