/**
 * TCE-PE Scraper — REST API Dados Abertos
 *
 * Tribunal de Contas do Estado de Pernambuco
 * URL: https://sistemas.tce.pe.gov.br/DadosAbertos/
 *
 * API REST com parametros GET:
 *   https://sistemas.tce.pe.gov.br/DadosAbertos/Resultados!json
 *   ?AnoAcordaoParecer=2025
 *   &TipoPesquisa=acordao (ou parecer, resolucao)
 *
 * Campos retornados: NrAcordao, AnoAcordao, DsTipoProcesso, NmRelator,
 *   DsOrgaoJulgador, DtSessao, DsEmenta, DsIndexacao, NrProcesso, UrlDocumento
 */

import { prisma } from '@/lib/prisma';
import type {
  TribunalScraper,
  TribunalScrapeOptions,
  TribunalScrapeResult,
  ScraperHealthStatus,
} from './index';
import { DEFAULT_SEARCH_TERMS } from './utils';
import {
  fetchWithRetry,
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

const SCRAPER_CODE = 'tce-pe';
const API_URL = 'https://sistemas.tce.pe.gov.br/DadosAbertos/Resultados!json';
const _HEALTH_CHECK_URL = 'https://sistemas.tce.pe.gov.br/DadosAbertos/';

const SEARCH_TYPES = ['acordao', 'parecer'] as const;

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
  decisionType?: string;
}

/** Represents a single item from the API response */
interface APIItem {
  NrAcordao?: string | number;
  AnoAcordao?: string | number;
  DsTipoProcesso?: string;
  NmRelator?: string;
  DsOrgaoJulgador?: string;
  DtSessao?: string;
  DsEmenta?: string;
  DsIndexacao?: string;
  NrProcesso?: string;
  UrlDocumento?: string;
  [key: string]: unknown;
}

// ===========================
// TCE-PE Scraper Implementation
// ===========================

class TCEPEScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCE-PE';
  fullName = 'Tribunal de Contas do Estado de Pernambuco';
  type = 'tce' as const;
  hasApi = true;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const currentYear = new Date().getFullYear();
      const params = new URLSearchParams({
        AnoAcordaoParecer: String(currentYear),
        TipoPesquisa: 'acordao',
      });
      const url = `${API_URL}?${params.toString()}`;

      const response = await fetchWithRetry(url, {
        timeoutMs: 15000,
        maxRetries: 1,
        headers: { 'Accept': 'application/json' },
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
        message: response.ok ? 'API Dados Abertos acessivel' : `HTTP ${response.status}`,
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
      const currentYear = new Date().getFullYear();
      const yearsToFetch = [currentYear, currentYear - 1];
      const allItems: APIItem[] = [];
      const seenKeys = new Set<string>();

      for (const year of yearsToFetch) {
        for (const tipoPesquisa of SEARCH_TYPES) {
          try {
            const items = await this.fetchDecisions(year, tipoPesquisa);

            // Dedup within fetch
            for (const item of items) {
              const key = `${item.NrAcordao}-${item.AnoAcordao}-${tipoPesquisa}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allItems.push(item);
              }
            }

            console.log(`[${SCRAPER_CODE}] Fetched ${items.length} items for ${year}/${tipoPesquisa}`);
            await sleep(1500); // Rate limit
          } catch (error) {
            const msg = `API fetch failed for ${year}/${tipoPesquisa}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(msg);
            console.error(`[${SCRAPER_CODE}]`, msg);
          }
        }
      }

      if (allItems.length === 0) {
        throw new Error('No data from API for any year/type');
      }

      // Filter by search terms
      const filtered = this.filterBySearchTerms(allItems, searchTerms);
      console.log(`[${SCRAPER_CODE}] Filtered ${filtered.length} relevant items from ${allItems.length} total`);

      // Convert to RawDecision
      const decisions = filtered.map(item => this.apiItemToDecision(item));

      // Dedup by decision number
      const seenDecisions = new Set<string>();
      const unique = decisions.filter(d => {
        const key = normalizeDecisionNumber(d.decisionNumber);
        if (seenDecisions.has(key)) return false;
        seenDecisions.add(key);
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
        metadata: {
          totalAPIItems: allItems.length,
          filteredItems: filtered.length,
          source: 'dados-abertos-api',
        },
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
  // API Fetch
  // ===========================

  private async fetchDecisions(year: number, tipoPesquisa: string): Promise<APIItem[]> {
    const params = new URLSearchParams({
      AnoAcordaoParecer: String(year),
      TipoPesquisa: tipoPesquisa,
    });
    const url = `${API_URL}?${params.toString()}`;

    const response = await fetchWithRetry(url, {
      timeoutMs: 30000,
      maxRetries: 2,
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${year}/${tipoPesquisa}`);
    }

    const data = await response.json();

    // API may return array directly or wrapped in an object
    if (Array.isArray(data)) {
      return data as APIItem[];
    }

    // Some APIs wrap in { results: [...] } or similar
    if (data && typeof data === 'object') {
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          return data[key] as APIItem[];
        }
      }
    }

    return [];
  }

  // ===========================
  // Filter by search terms
  // ===========================

  private filterBySearchTerms(items: APIItem[], searchTerms: string[]): APIItem[] {
    const termsLower = searchTerms.map(t => t.toLowerCase());

    return items.filter(item => {
      // Always include Consulta/Prejulgado types
      const tipoProcesso = (item.DsTipoProcesso || '').toLowerCase();
      if (/consulta|prejulgado/.test(tipoProcesso)) {
        return true;
      }

      // Combine searchable fields
      const searchable = [
        item.DsEmenta || '',
        item.DsIndexacao || '',
        item.DsTipoProcesso || '',
      ]
        .join(' ')
        .toLowerCase();

      return termsLower.some(term => searchable.includes(term));
    });
  }

  // ===========================
  // API Item → RawDecision
  // ===========================

  private apiItemToDecision(item: APIItem): RawDecision {
    const nrAcordao = String(item.NrAcordao || '').trim();
    const anoAcordao = String(item.AnoAcordao || '').trim();
    const decisionNumber = nrAcordao && anoAcordao ? `${nrAcordao}/${anoAcordao}` : nrAcordao || 'unknown';

    const ementa = (item.DsEmenta || '').trim();
    const indexacao = (item.DsIndexacao || '').trim();
    const tipoProcesso = (item.DsTipoProcesso || '').trim();

    let ementaFinal = ementa;
    if (!ementaFinal && indexacao) {
      ementaFinal = indexacao;
    }

    const urlDoc = (item.UrlDocumento || '').trim();

    return {
      decisionNumber,
      title: `${tipoProcesso || 'Acordao'} ${decisionNumber} TCE-PE`,
      ementa: ementaFinal || `Acordao ${decisionNumber}`,
      relator: (item.NmRelator || '').trim() || undefined,
      orgaoJulgador: (item.DsOrgaoJulgador || '').trim() || undefined,
      dataJulgamento: (item.DtSessao || '').trim() || undefined,
      url: urlDoc || undefined,
      processNumber: (item.NrProcesso || '').trim() || undefined,
      decisionType: tipoProcesso || undefined,
    };
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
      decisionType: raw.decisionType,
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
      sourceApi: 'tce-pe-dados-abertos',
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

const tcePEScraper = new TCEPEScraper();

export { tcePEScraper };
export default tcePEScraper;
