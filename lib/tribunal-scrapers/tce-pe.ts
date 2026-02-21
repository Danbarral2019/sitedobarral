/**
 * TCE-PE Scraper — Portal Jurisprudencia API (JHipster REST)
 *
 * Tribunal de Contas do Estado de Pernambuco
 * URL: https://portal.tce.pe.gov.br/jurisprudencia/
 *
 * API REST publica (sem autenticacao):
 *   https://portal.tce.pe.gov.br/jurisprudencia/services/jurisprudencia/api/publico/
 *
 * Endpoints usados:
 *   GET /deliberacoes?page=N&size=200&sort=dataJulgamentoProcesso,desc
 *       → 57.623+ acordaos paginados (X-Total-Count header)
 *   GET /sumulas
 *       → ~10 sumulas vigentes
 *
 * Campos da deliberacao:
 *   nomeTipoDocumento (ACORDAO), numeroProcessoProcesso, anoProcessoProcesso,
 *   numeroDeliberacaoProcesso, anoDeliberacaoProcesso, dataJulgamentoProcesso (ISO),
 *   descricaoTipoProcessoProcesso, descricaoParecerProcesso (HTML inteiro teor)
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

const SCRAPER_CODE = 'tce-pe';
const API_BASE = 'https://portal.tce.pe.gov.br/jurisprudencia/services/jurisprudencia/api/publico';
const PAGE_SIZE = 200;
const MAX_PAGES = 50; // Safety limit: 200 * 50 = 10.000 items max scan

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

/** A single deliberacao from the Portal API */
interface DeliberacaoItem {
  nomeTipoDocumento?: string;
  numeroProcessoProcesso?: string;
  anoProcessoProcesso?: string;
  numeroDeliberacaoProcesso?: string;
  anoDeliberacaoProcesso?: string;
  dataJulgamentoProcesso?: string;
  descricaoTipoProcessoProcesso?: string;
  descricaoParecerProcesso?: string;
  origemProcessoProcesso?: string;
  codigoValidacaoDocumentoDeliberacaoETCE?: string;
  // Campos adicionais descobertos na API
  detalheProcessoNomeServidor?: string;
  detalheProcessoNomeOrgaoJulgador?: string;
  detalheProcessoNomeUnidadeJurisdicionada?: string;
  modalidadeProcesso?: string;
  linkConsultaProcesso?: string;
  linkDocumentoDeliberacao?: string;
  linkDocumentoITD?: string;
  [key: string]: unknown;
}

/** A single sumula from the Portal API */
interface SumulaItem {
  id: number;
  descricao?: string;
  titulo?: string;
  numero?: number;
  statusCancelado?: boolean;
  indexadoresComplementares?: string;
  nomeServidor?: string;
  nomeOrgaoJulgador?: string;
  numeroProcesso?: string;
  anoProcesso?: string;
  excluido?: boolean;
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
  supportsFullText = true;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const url = `${API_BASE}/deliberacoes?page=0&size=1`;
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
        message: response.ok ? 'Portal Jurisprudencia API acessivel' : `HTTP ${response.status}`,
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
      const allItems: DeliberacaoItem[] = [];
      const minYear = new Date().getFullYear() - 1;

      // Fetch deliberacoes paginated (most recent first)
      for (let page = 0; page < MAX_PAGES; page++) {
        try {
          const items = await this.fetchDeliberacoes(page);

          if (items.length === 0) break;

          allItems.push(...items);
          console.log(`[${SCRAPER_CODE}] Page ${page}: ${items.length} deliberacoes (total: ${allItems.length})`);

          // Stop if we've gone past the year range
          const lastItem = items[items.length - 1];
          const lastDate = lastItem.dataJulgamentoProcesso || '';
          const lastYear = lastDate ? parseInt(lastDate.slice(0, 4), 10) : 0;
          if (lastYear > 0 && lastYear < minYear) {
            console.log(`[${SCRAPER_CODE}] Reached year ${lastYear}, stopping pagination`);
            break;
          }

          await sleep(500);
        } catch (error) {
          const msg = `Page ${page} fetch failed: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(msg);
          console.error(`[${SCRAPER_CODE}]`, msg);
          break;
        }
      }

      // Also fetch sumulas
      try {
        const sumulas = await this.fetchSumulas();
        const sumulaDecisions = sumulas.map(s => this.sumulaToDecision(s));
        console.log(`[${SCRAPER_CODE}] Fetched ${sumulas.length} sumulas`);

        // Process sumulas directly (always relevant)
        for (const raw of sumulaDecisions) {
          try {
            await this.processDecision(raw, result, forceRescrape);
          } catch (error) {
            result.itemsError++;
            result.errors.push(
              `Error processing sumula ${raw.decisionNumber}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      } catch (error) {
        const msg = `Sumulas fetch failed: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(msg);
        console.error(`[${SCRAPER_CODE}]`, msg);
      }

      if (allItems.length === 0) {
        throw new Error('No deliberacoes returned from Portal API');
      }

      // Filter by search terms
      const filtered = this.filterBySearchTerms(allItems, searchTerms);
      console.log(`[${SCRAPER_CODE}] Filtered ${filtered.length} relevant deliberacoes from ${allItems.length} total`);

      // Convert to RawDecision
      const decisions = filtered.map(item => this.deliberacaoToDecision(item));

      // Dedup by decision number
      const seen = new Set<string>();
      const unique = decisions.filter(d => {
        const key = normalizeDecisionNumber(d.decisionNumber);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      result.itemsFound += unique.length;

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
          totalDeliberacoes: allItems.length,
          filteredItems: filtered.length,
          source: 'portal-jurisprudencia-api',
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
  // Fetch deliberacoes (paginated)
  // ===========================

  private async fetchDeliberacoes(page: number): Promise<DeliberacaoItem[]> {
    const url = `${API_BASE}/deliberacoes?page=${page}&size=${PAGE_SIZE}&sort=dataJulgamentoProcesso,desc`;

    const response = await fetchWithRetry(url, {
      timeoutMs: 30000,
      maxRetries: 2,
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for deliberacoes page ${page}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(`Expected JSON array for deliberacoes, got ${typeof data}`);
    }

    return data as DeliberacaoItem[];
  }

  // ===========================
  // Fetch sumulas
  // ===========================

  private async fetchSumulas(): Promise<SumulaItem[]> {
    const url = `${API_BASE}/sumulas`;

    const response = await fetchWithRetry(url, {
      timeoutMs: 15000,
      maxRetries: 2,
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for sumulas`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    // Filter out cancelled and deleted sumulas
    return (data as SumulaItem[]).filter(s => !s.statusCancelado && !s.excluido);
  }

  // ===========================
  // Filter by search terms
  // ===========================

  private filterBySearchTerms(items: DeliberacaoItem[], searchTerms: string[]): DeliberacaoItem[] {
    const termsLower = searchTerms.map(t => t.toLowerCase());

    return items.filter(item => {
      // Always include Consulta types
      const tipoProcesso = (item.descricaoTipoProcessoProcesso || '').toLowerCase();
      if (/consulta|prejulgado/.test(tipoProcesso)) {
        return true;
      }

      // Search in the full text of the deliberation
      const parecer = (item.descricaoParecerProcesso || '').toLowerCase();
      const tipo = tipoProcesso;

      const searchable = `${parecer} ${tipo}`;
      return termsLower.some(term => searchable.includes(term));
    });
  }

  // ===========================
  // Deliberacao → RawDecision
  // ===========================

  private deliberacaoToDecision(item: DeliberacaoItem): RawDecision {
    const numDelib = (item.numeroDeliberacaoProcesso || '').trim();
    const anoDelib = (item.anoDeliberacaoProcesso || '').trim();
    const decisionNumber = numDelib && anoDelib ? `${numDelib}/${anoDelib}` : numDelib || 'unknown';

    const tipoDoc = (item.nomeTipoDocumento || 'Acordao').trim();
    const tipoProcesso = (item.descricaoTipoProcessoProcesso || '').trim();
    const modalidade = (item.modalidadeProcesso || '').trim();

    // Extract plain text from HTML inteiro teor
    const parecerHtml = (item.descricaoParecerProcesso || '').trim();
    const fullText = parecerHtml ? extractTextFromHTML(parecerHtml) : undefined;

    // Extract ementa: try to find RELATÓRIO/EMENTA section, skip header boilerplate
    const ementa = fullText ? this.extractEmenta(fullText, tipoDoc, decisionNumber) : '';

    // Use direct links from API (prefer ITD link, fallback to deliberacao link, then consultation)
    const url = (item.linkDocumentoITD || item.linkDocumentoDeliberacao || item.linkConsultaProcesso || '').trim() || undefined;

    const relator = (item.detalheProcessoNomeServidor || '').trim() || undefined;
    const orgaoJulgador = (item.detalheProcessoNomeOrgaoJulgador || '').trim() || undefined;
    const unidade = (item.detalheProcessoNomeUnidadeJurisdicionada || '').trim();

    // Build descriptive title
    const titleParts = [`${tipoDoc} ${decisionNumber} TCE-PE`];
    if (modalidade) titleParts.push(`(${modalidade})`);
    else if (tipoProcesso) titleParts.push(`(${tipoProcesso})`);

    return {
      decisionNumber,
      title: titleParts.join(' '),
      ementa: ementa || (unidade ? `${tipoDoc} ${decisionNumber} - ${unidade}` : `${tipoDoc} ${decisionNumber}`),
      fullText,
      relator,
      orgaoJulgador,
      dataJulgamento: (item.dataJulgamentoProcesso || '').trim() || undefined,
      url,
      processNumber: (item.numeroProcessoProcesso || '').trim() || undefined,
      decisionType: tipoProcesso || undefined,
    };
  }

  /**
   * Extrai a parte mais relevante do inteiro teor para servir como ementa.
   * Tenta encontrar seções como RELATÓRIO, EMENTA, VOTO, DECISÃO.
   * Se não encontrar, pula o cabeçalho e retorna os primeiros 2000 chars.
   */
  private extractEmenta(fullText: string, tipoDoc: string, decisionNumber: string): string {
    // Try to find a meaningful section start
    const sectionPatterns = [
      /EMENTA[:\s]/i,
      /RELAT[OÓ]RIO[:\s]/i,
      /VOTO[:\s]/i,
    ];

    for (const pattern of sectionPatterns) {
      const match = fullText.match(pattern);
      if (match && match.index !== undefined) {
        return fullText.slice(match.index, match.index + 2000).trim();
      }
    }

    // Skip the header boilerplate (INTEIRO TEOR DA DELIBERAÇÃO, session info, etc.)
    // Find where the actual content starts after INTERESSADOS/RELATÓRIO sections
    const contentStart = fullText.search(/(?:INTERESSADOS|OBJETO|ASSUNTO)[:\s]/i);
    if (contentStart > 0 && contentStart < fullText.length - 100) {
      return fullText.slice(contentStart, contentStart + 2000).trim();
    }

    // Fallback: skip first 200 chars of boilerplate, take 2000
    const start = Math.min(200, fullText.length);
    return fullText.slice(start, start + 2000).trim();
  }

  // ===========================
  // Sumula → RawDecision
  // ===========================

  private sumulaToDecision(item: SumulaItem): RawDecision {
    const numero = String(item.numero || item.id);
    const descricao = (item.descricao || '').trim();

    return {
      decisionNumber: numero,
      title: `Sumula ${numero} TCE-PE`,
      ementa: descricao || `Sumula ${numero}`,
      relator: (item.nomeServidor || '').trim() || undefined,
      orgaoJulgador: (item.nomeOrgaoJulgador || '').trim() || undefined,
      dataJulgamento: undefined,
      processNumber: item.numeroProcesso
        ? `${item.numeroProcesso}${item.anoProcesso ? `/${item.anoProcesso}` : ''}`
        : undefined,
      decisionType: 'sumula',
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
    const decisionType = raw.decisionType === 'sumula' ? 'sumula' : 'acordao';
    const fullIdentifier = buildFullIdentifier(SCRAPER_CODE, decisionType, normalized);

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
      summary = await generateDecisionSummary({
        title: raw.title,
        ementa: raw.ementa,
        fullText: raw.fullText,
        decisionType: raw.decisionType,
      });
    }

    const data = {
      tribunalCode: SCRAPER_CODE,
      tribunalName: this.fullName,
      decisionType,
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
      url: raw.url || null,
      isRelevant: classification.approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      leiArticles: JSON.stringify(classification.leiArticles),
      suggestedCourses: classification.suggestedCourses,
      sourceApi: 'tce-pe-portal-jurisprudencia',
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
