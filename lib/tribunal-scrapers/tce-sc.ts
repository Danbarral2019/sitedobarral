/**
 * TCE-SC Scraper — API REST (Prejulgados)
 *
 * Tribunal de Contas do Estado de Santa Catarina
 * URL: https://www.tce.sc.gov.br
 *
 * Usa a API REST publica de prejulgados do TCE-SC:
 *   https://servicos.tcesc.tc.br/cojur/prejulgado
 *
 * Endpoints:
 *   GET /cojur/prejulgado?page=1  — health check (paginado)
 *   GET /cojur/prejulgado/all     — todos os prejulgados (~2.544 itens)
 *
 * Campos retornados por item:
 *   nu_prejulgado, de_prejulgado, nm_relator, nm_origem,
 *   data_sessao (YYYY-MM-DD HH:MM:SS), assuntos[].rotulo, st_valido ("S"/"N")
 */

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
  parseBRDate,
  logScraperHealth,
} from './utils';
import { classifyDecision, generateDecisionSummary } from './classifier';

// ===========================
// Constants
// ===========================

const SCRAPER_CODE = 'tce-sc';
const API_BASE = 'https://servicos.tcesc.tc.br/cojur/prejulgado';

// ===========================
// Types
// ===========================

interface APIPrejulgado {
  nu_prejulgado?: number | string;
  de_prejulgado?: string;
  nm_relator?: string;
  nm_origem?: string;
  data_sessao?: string;
  st_valido?: string;
  assuntos?: Array<{ rotulo?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface RawDecision {
  decisionNumber: string;
  title: string;
  ementa: string;
  relator?: string;
  orgaoJulgador?: string;
  dataJulgamento?: string;
  themes: string[];
}

// ===========================
// TCE-SC Scraper Implementation
// ===========================

class TCESCScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCE-SC';
  fullName = 'Tribunal de Contas do Estado de Santa Catarina';
  type = 'tce' as const;
  hasApi = true;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const response = await fetchWithRetry(`${API_BASE}?page=1`, {
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
        message: response.ok ? 'API REST de prejulgados acessivel' : `HTTP ${response.status}`,
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
      const decisions = await this.fetchPrejulgados();

      if (decisions.length === 0) {
        console.log(`[${SCRAPER_CODE}] Nenhum prejulgado retornado pela API.`);
        result.duration = Date.now() - startTime;
        await logScraperHealth(SCRAPER_CODE, 'success', {
          itemsFound: 0,
          itemsNew: 0,
          duration: result.duration,
          metadata: { source: 'api-rest', note: 'API retornou 0 itens' },
        });
        return result;
      }

      console.log(`[${SCRAPER_CODE}] Fetched ${decisions.length} prejulgados from API`);
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
        metadata: { source: 'api-rest' },
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
  // Fetch all prejulgados via API
  // ===========================

  private async fetchPrejulgados(): Promise<RawDecision[]> {
    const url = `${API_BASE}/all`;

    const response = await fetchWithRetry(url, {
      timeoutMs: 60000, // 60s — can be large payload
      maxRetries: 2,
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const data = await response.json();

    // API returns an array of prejulgados
    const items: APIPrejulgado[] = Array.isArray(data) ? data : [];

    if (items.length === 0) {
      console.warn(`[${SCRAPER_CODE}] API returned empty or non-array response`);
      return [];
    }

    // Filter only valid prejulgados (st_valido === "S") and convert
    return items
      .filter(item => item.st_valido === 'S')
      .map(item => this.apiItemToDecision(item));
  }

  // ===========================
  // API Item → RawDecision
  // ===========================

  private apiItemToDecision(item: APIPrejulgado): RawDecision {
    const numero = String(item.nu_prejulgado || '').trim();
    const ementa = (item.de_prejulgado || '').trim();
    const relator = (item.nm_relator || '').trim() || undefined;
    const orgaoJulgador = (item.nm_origem || '').trim() || undefined;

    // data_sessao comes as "YYYY-MM-DD HH:MM:SS" — extract date part
    const dataSessao = (item.data_sessao || '').trim() || undefined;

    // Extract theme labels from assuntos array
    const themes: string[] = [];
    if (Array.isArray(item.assuntos)) {
      for (const assunto of item.assuntos) {
        const rotulo = (assunto.rotulo || '').trim();
        if (rotulo) themes.push(rotulo);
      }
    }

    return {
      decisionNumber: numero || 'unknown',
      title: `Prejulgado ${numero} TCE-SC`,
      ementa: ementa || `Prejulgado ${numero}`,
      relator,
      orgaoJulgador,
      dataJulgamento: dataSessao,
      themes,
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
    const fullIdentifier = buildFullIdentifier(SCRAPER_CODE, 'prejulgado', normalized);

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
    const dataJulgamento = raw.dataJulgamento ? parseBRDate(raw.dataJulgamento) : null;

    // Generate AI summary for approved decisions
    let summary: string | null = null;
    if (classification.approvalStatus === 'auto_approved') {
      summary = await generateDecisionSummary({ title: raw.title, ementa: raw.ementa, decisionType: 'prejulgado' });
    }

    const data = {
      tribunalCode: SCRAPER_CODE,
      tribunalName: this.fullName,
      decisionType: 'prejulgado',
      decisionNumber: normalized,
      processNumber: null,
      year,
      fullIdentifier,
      title: raw.title,
      ementa: raw.ementa,
      summary,
      relator: raw.relator || null,
      orgaoJulgador: raw.orgaoJulgador || null,
      dataJulgamento,
      url: null,
      isRelevant: classification.approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      leiArticles: JSON.stringify(classification.leiArticles),
      suggestedCourses: classification.suggestedCourses,
      sourceApi: 'tce-sc-api-rest',
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
