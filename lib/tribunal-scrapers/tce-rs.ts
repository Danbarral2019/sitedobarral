/**
 * TCE-RS Scraper — Dados Abertos CKAN (JSON)
 *
 * Tribunal de Contas do Estado do Rio Grande do Sul
 * URL: https://dados.tce.rs.gov.br
 *
 * Usa arquivos JSON dos Dados Abertos do TCE-RS.
 * JSON disponivel por ano em:
 *   https://dados.tce.rs.gov.br/dados/decisoes/{YEAR}.json
 *
 * JSON: objeto { decisoes: [...] } com campos por decisao:
 *   NR_PROCESSO (number), TIPO_PROCESSO, MAGISTRADO, ORGAO_JULGADOR,
 *   DATA_SESSAO (DD/MM/YYYY), DECISAO (texto HTML),
 *   ANO_SESSAO, TIPO_SESSAO, NOME_ORGAO, GABINETE, NUMERO_SESSAO, etc.
 * Anos disponíveis: 2011-2025
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
  extractTextFromHTML,
} from './utils';
import { classifyDecision, generateDecisionSummary } from './classifier';

// ===========================
// Constants
// ===========================

const SCRAPER_CODE = 'tce-rs';
const BASE_URL = 'https://dados.tce.rs.gov.br';
const DECISOES_URL = `${BASE_URL}/dados/decisoes`;

// ===========================
// Types
// ===========================

interface RawDecision {
  decisionNumber: string;
  title: string;
  ementa: string;
  fullText?: string;
  relator?: string;
  orgaoJulgador?: string;
  dataJulgamento?: string;
  url?: string;
  processNumber?: string;
  decisionType?: string;
}

/** Represents a single item from the JSON decisoes array */
interface JSONItem {
  NR_PROCESSO?: number | string;
  TIPO_PROCESSO?: string;
  MAGISTRADO?: string;
  ORGAO_JULGADOR?: string;
  NOME_ORGAO?: string;
  DATA_SESSAO?: string;
  DECISAO?: string;
  ANO_SESSAO?: number | string;
  TIPO_SESSAO?: string;
  GABINETE?: string;
  NUMERO_SESSAO?: number | string;
  LINK_VIDEO_SESSAO?: string;
  [key: string]: unknown;
}

// ===========================
// TCE-RS Scraper Implementation
// ===========================

class TCERSScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCE-RS';
  fullName = 'Tribunal de Contas do Estado do Rio Grande do Sul';
  type = 'tce' as const;
  hasApi = true;
  supportsFullText = true;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const currentYear = new Date().getFullYear();
      const url = `${DECISOES_URL}/${currentYear}.json`;
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
        message: response.ok ? 'API Dados Abertos acessivel (JSON)' : `HTTP ${response.status}`,
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
      const allItems: JSONItem[] = [];

      for (const year of yearsToFetch) {
        try {
          const items = await this.downloadJSON(year);
          allItems.push(...items);
          console.log(`[${SCRAPER_CODE}] Downloaded ${items.length} items for year ${year}`);
          await sleep(1000);
        } catch (error) {
          const msg = `JSON download failed for ${year}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(msg);
          console.error(`[${SCRAPER_CODE}]`, msg);
        }
      }

      if (allItems.length === 0) {
        throw new Error('No JSON data downloaded for any year');
      }

      // Filter by relevance
      const filtered = this.filterBySearchTerms(allItems, searchTerms);
      console.log(`[${SCRAPER_CODE}] Filtered ${filtered.length} relevant items from ${allItems.length} total`);

      // Convert to RawDecision
      const decisions = filtered.map(item => this.jsonItemToDecision(item));

      // Dedup by decision number
      const seen = new Set<string>();
      const unique = decisions.filter(d => {
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
        metadata: {
          totalJSONItems: allItems.length,
          filteredItems: filtered.length,
          source: 'dados-abertos-json',
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
  // JSON Download
  // ===========================

  private async downloadJSON(year: number): Promise<JSONItem[]> {
    const url = `${DECISOES_URL}/${year}.json`;

    const response = await fetchWithRetry(url, {
      timeoutMs: 60000, // 60s — JSON files can be large
      maxRetries: 2,
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${year}.json`);
    }

    const data = await response.json();

    // JSON real é { decisoes: [...] }, não array raiz
    if (Array.isArray(data)) {
      return data as JSONItem[];
    }

    if (data && Array.isArray(data.decisoes)) {
      return data.decisoes as JSONItem[];
    }

    throw new Error(`Expected JSON object with "decisoes" array for ${year}, got ${typeof data}`);
  }

  // ===========================
  // Filter by search terms
  // ===========================

  private filterBySearchTerms(items: JSONItem[], searchTerms: string[]): JSONItem[] {
    const termsLower = searchTerms.map(t => t.toLowerCase());

    return items.filter(item => {
      // Always include Consulta/Prejulgado types (paradigmatic decisions)
      const tipoProcesso = (item.TIPO_PROCESSO || '').toLowerCase();
      if (/consulta|prejulgado/.test(tipoProcesso)) {
        return true;
      }

      // Combine searchable fields
      const searchable = [
        item.DECISAO || '',
        item.TIPO_PROCESSO || '',
      ]
        .join(' ')
        .toLowerCase();

      return termsLower.some(term => searchable.includes(term));
    });
  }

  // ===========================
  // JSON Item → RawDecision
  // ===========================

  private jsonItemToDecision(item: JSONItem): RawDecision {
    const nrProcesso = String(item.NR_PROCESSO ?? '').trim();
    const anoSessao = String(item.ANO_SESSAO ?? '').trim();
    const decisionNumber = nrProcesso && anoSessao ? `${nrProcesso}/${anoSessao}` : nrProcesso || 'unknown';

    const tipoProcesso = (item.TIPO_PROCESSO || '').trim();
    const magistrado = (item.MAGISTRADO || '').trim();
    const orgaoJulgador = (item.ORGAO_JULGADOR || '').trim();
    const nomeOrgao = (item.NOME_ORGAO || '').trim();
    const dataSessao = (item.DATA_SESSAO || '').trim();

    // Extract plain text from DECISAO HTML field
    const decisaoHtml = (item.DECISAO || '').trim();
    const fullText = decisaoHtml ? extractTextFromHTML(decisaoHtml) : undefined;

    // Build rich ementa from metadata + DECISAO text
    // DECISAO field is very short (avg 97 chars) — just vote outcomes
    // So we compose ementa from all available metadata
    const ementaParts = [
      tipoProcesso ? `${tipoProcesso}.` : '',
      nomeOrgao ? `Orgao: ${nomeOrgao}.` : '',
      magistrado ? `Relator: ${magistrado}.` : '',
      orgaoJulgador ? `Orgao Julgador: ${orgaoJulgador}.` : '',
      dataSessao ? `Sessao: ${dataSessao}.` : '',
      fullText || '',
    ].filter(Boolean).join(' ').trim();

    return {
      decisionNumber,
      title: `${tipoProcesso || 'Decisao'} ${decisionNumber} TCE-RS`,
      ementa: ementaParts || `Decisao ${decisionNumber}`,
      fullText,
      relator: magistrado || undefined,
      orgaoJulgador: orgaoJulgador || undefined,
      dataJulgamento: dataSessao || undefined,
      processNumber: nrProcesso || undefined,
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
      fullText: raw.fullText,
      decisionType: raw.decisionType,
    });

    const year = extractYear(normalized);
    const dataJulgamento = raw.dataJulgamento ? parseBRDate(raw.dataJulgamento) : null;

    // Generate AI summary for approved decisions
    let summary: string | null = null;
    if (classification.approvalStatus === 'auto_approved') {
      summary = await generateDecisionSummary({ title: raw.title, ementa: raw.ementa, fullText: raw.fullText, decisionType: raw.decisionType });
    }

    // Construct URL to TCE-RS process search
    const processUrl = raw.processNumber
      ? `https://portal.tce.rs.gov.br/aplicprod/f?p=10101:1::::RP:P1_NR_PROCESSO:${raw.processNumber}`
      : null;

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
      summary,
      relator: raw.relator || null,
      orgaoJulgador: raw.orgaoJulgador || null,
      dataJulgamento,
      url: processUrl,
      isRelevant: classification.approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      leiArticles: JSON.stringify(classification.leiArticles),
      suggestedCourses: classification.suggestedCourses,
      sourceApi: 'tce-rs-dados-abertos',
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

const tceRSScraper = new TCERSScraper();

export { tceRSScraper };
export default tceRSScraper;
