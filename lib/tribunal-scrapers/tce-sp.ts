/**
 * TCE-SP Scraper
 *
 * Tribunal de Contas do Estado de Sao Paulo
 * URL: https://www.tce.sp.gov.br/jurisprudencia/pesquisar
 *
 * Busca decisoes relacionadas a licitacoes e contratos administrativos.
 * Scraping HTML da tabela de resultados de jurisprudencia.
 *
 * Search URL pattern:
 *   GET /jurisprudencia/pesquisar?txtTdPalvs=TERM&tipoBuscaTxt=Documento&tipoDocumento=3&quantTrechos=1&acao=Executa&offset=X
 *
 * Results: HTML table `table.table-docs` with pairs of rows:
 *   1. Data row (tr.borda-superior): 8 cells (Doc, Nº Proc, Autuacao, Parte 1, Parte 2, Materia, Objeto, Exercicio)
 *   2. Snippet row (tr > td colspan=8): ementa/excerpt text
 *
 * 20 results per page, paginated via offset parameter.
 */

import * as cheerio from 'cheerio';
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
  rateLimitedFetch,
  normalizeDecisionNumber,
  buildFullIdentifier,
  normalizeTribunalCode,
  extractYear,
  parseBRDate,
  logScraperHealth,
  sleep,
} from './utils';
import { classifyDecision, generateDecisionSummary } from './classifier';
import { setLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from "@/lib/logger";

// ===========================
// Constants
// ===========================

const SCRAPER_CODE = 'tce-sp';
const BASE_URL = 'https://www.tce.sp.gov.br';
const SEARCH_URL = `${BASE_URL}/jurisprudencia/pesquisar`;
const HEALTH_CHECK_URL = `${BASE_URL}/jurisprudencia/`;
const PDF_BASE_URL = 'https://jurisprudencia.tce.sp.gov.br/arqs_juri/pdf';
const RESULTS_PER_PAGE = 20;

// ===========================
// Ementa text cleanup
// ===========================

/**
 * Limpa texto de ementa extraído de PDFs do TCE-SP.
 * Remove artefatos comuns: números de página isolados, cabeçalhos de gabinete,
 * informações de contato, e normaliza espaços em branco.
 */
function cleanEmentaText(raw: string): string {
  let text = raw;

  // Remove prefixo "Trechos localizados no documento: ..." (pode ter espaços entre pontos)
  text = text.replace(/Trechos\s+localizados\s+no\s+documento\s*:\s*[.\s]*/i, '');

  // Remove blocos de gabinete/contato (ex: "GABINETE DO CONSELHEIRO\nDIMAS RAMALHO\n(11) 3292-3235 - gcder@tce.sp.gov.br")
  text = text.replace(/GABINETE\s+D[OA]\s+CONSELHEIRO[A]?\s*\n[^\n]+\n\s*\(\d{2}\)\s*[\d\s.-]+\s*-\s*\S+@\S+/gi, '');

  // Remove linhas de contato isoladas (telefone + email)
  text = text.replace(/\(\d{2}\)\s*[\d\s.-]+\s*-\s*\S+@\S+/g, '');

  // Remove emails isolados
  text = text.replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '');

  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, '');

  // Remove referências de folha ("Fl. 209", "Fls. 123")
  text = text.replace(/\bFls?\.?\s*\d+\b/gi, '');

  // Remove números de página isolados (linha contendo apenas 1-3 dígitos)
  text = text.replace(/^\s*\d{1,3}\s*$/gm, '');

  // Remove "Página X de Y" ou "Pag. X"
  text = text.replace(/p[aá]g(?:ina)?\.?\s*\d+\s*(?:de\s*\d+)?/gi, '');

  // Remove "TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO" e variantes
  text = text.replace(/TRIBUNAL\s+DE\s+CONTAS\s+DO\s+ESTADO\s+DE\s+S[AÃ]O\s+PAULO/gi, '');

  // Remove "CORPO DE AUDITORES"
  text = text.replace(/CORPO\s+DE\s+AUDITORES/gi, '');

  // Remove "SENTENÇA DO(A) AUDITOR(A) NOME"
  text = text.replace(/SENTEN[CÇ]A\s+D[OA]\s+AUDITOR[A]?\s+[\wÀ-ú\s]+(?=PROCESSO)/gi, '');

  // Remove número TC solto antes de PROCESSO: (redundante)
  text = text.replace(/TC-?\s*[\d./]+\s+(?=PROCESSO)/gi, '');

  // Remove endereços (Av./Rua ... CEP ... cidade/UF)
  text = text.replace(/(?:Av\.|Rua|Alameda|Praça)[^,\n]+,\s*\d+[^P\n]*(?:CEP|cep)[:\s-]*[\d.-]+[^\n]*/gi, '');

  // Remove nomes de arquivo Word/PDF (ex: "Microsoft Word - Ambiente3110769.doc")
  text = text.replace(/Microsoft\s+Word\s*-\s*\S+\.doc[x]?\s*/gi, '');

  // Remove "S E N T E N Ç A" (letras espaçadas)
  text = text.replace(/S\s+E\s+N\s+T\s+E\s+N\s+[CÇ]\s+A/gi, 'SENTENÇA');

  // Remove "PABX: (11) ..."
  text = text.replace(/PABX\s*:\s*\(\d{2}\)\s*[\d\s.-]+/gi, '');

  // Remove "Internet: ..."
  text = text.replace(/Internet\s*:\s*\S+/gi, '');

  // Colapsa múltiplas quebras de linha em espaço único
  text = text.replace(/\n+/g, ' ');

  // Colapsa múltiplos espaços em um
  text = text.replace(/\s{2,}/g, ' ');

  return text.trim();
}

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
      const response = await fetchWithRetry(HEALTH_CHECK_URL, { timeoutMs: 15000, maxRetries: 1 });
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
          apiLogger.error({ err: msg }, `[${SCRAPER_CODE}]`);
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
          apiLogger.error({ err: msg }, `[${SCRAPER_CODE}]`);
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
    try {
      // Search regular documents (tipoDocumento=3)
      const regular = await this.searchViaHTML(term, limit, '3');
      // Also search Consultas (tipoDocumento=7) for paradigmatic decisions
      const consultas = await this.searchViaHTML(term, Math.min(limit, 20), '7');
      return [...regular, ...consultas];
    } catch (error) {
      console.warn(`[${SCRAPER_CODE}] HTML search failed for "${term}":`, error);
      return [];
    }
  }

  // ===========================
  // HTML scraping approach
  // ===========================

  private async searchViaHTML(term: string, limit: number, tipoDocumento = '3'): Promise<RawDecision[]> {
    const allResults: RawDecision[] = [];
    let offset = 0;

    while (allResults.length < limit) {
      const params = new URLSearchParams({
        txtTdPalvs: term,
        tipoBuscaTxt: 'Documento',
        tipoDocumento,
        quantTrechos: '1',
        acao: 'Executa',
      });

      if (offset > 0) {
        params.set('offset', String(offset));
      }

      const url = `${SEARCH_URL}?${params.toString()}`;
      console.log(`[${SCRAPER_CODE}] Fetching: ${url}`);

      const response = await rateLimitedFetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for search: ${term} (offset=${offset})`);
      }

      const html = await response.text();
      const { decisions, totalResults } = this.parseSearchResults(html, limit - allResults.length);

      if (decisions.length === 0) {
        // No more results on this page
        break;
      }

      allResults.push(...decisions);

      // Check if we have more pages
      offset += RESULTS_PER_PAGE;
      if (offset >= totalResults || decisions.length < RESULTS_PER_PAGE) {
        break;
      }

      // Rate limit between pages
      await sleep(1500);
    }

    return allResults.slice(0, limit);
  }

  // ===========================
  // Parse search result page
  // ===========================

  private parseSearchResults(
    html: string,
    limit: number
  ): { decisions: RawDecision[]; totalResults: number } {
    const $ = cheerio.load(html);
    const decisions: RawDecision[] = [];

    // Extract total results count from: <h3 class="nopadding">Foram encontrados 60447 registros</h3>
    let totalResults = 0;
    const totalText = $('h3.nopadding').text().trim();
    const totalMatch = totalText.match(/(\d[\d.]*)\s*registros?/i);
    if (totalMatch) {
      totalResults = parseInt(totalMatch[1].replace(/\./g, ''), 10);
    }

    // Find the results table
    const $table = $('table.table-docs');
    if ($table.length === 0) {
      console.warn(`[${SCRAPER_CODE}] No table.table-docs found in HTML`);
      return { decisions, totalResults };
    }

    // Each result is a pair of rows:
    //   1. tr.borda-superior — data row with 8 cells
    //   2. next tr — snippet row with td[colspan=8]
    const $dataRows = $table.find('tr.borda-superior');

    $dataRows.each((i, el) => {
      if (decisions.length >= limit) return false;

      const $row = $(el);
      const $cells = $row.find('td');

      if ($cells.length < 8) return; // skip malformed rows

      // Cell 0: Doc type — contains link to PDF, e.g. <a href="https://jurisprudencia.tce.sp.gov.br/arqs_juri/pdf/12345.pdf">Acordao</a>
      const $docCell = $cells.eq(0);
      const $docLink = $docCell.find('a');
      const docType = $docLink.text().trim() || $docCell.text().trim();
      const pdfUrl = $docLink.attr('href') || '';

      // Cell 1: Nº Proc — contains link like <a href="exibir?proc=10288/026/09">10288/026/09</a>
      const $procCell = $cells.eq(1);
      const $procLink = $procCell.find('a');
      const processNumber = $procLink.text().trim() || $procCell.text().trim();
      const procHref = $procLink.attr('href') || '';

      // Cell 2: Autuacao (date)
      const autuacao = $cells.eq(2).text().trim();

      // Cell 3: Parte 1
      const parte1 = $cells.eq(3).text().trim();

      // Cell 4: Parte 2
      const parte2 = $cells.eq(4).text().trim();

      // Cell 5: Materia
      const materia = $cells.eq(5).text().trim();

      // Cell 6: Objeto
      const objeto = $cells.eq(6).text().trim();

      // Cell 7: Exercicio (year)
      const _exercicio = $cells.eq(7).text().trim();

      // Get the snippet row — the next sibling tr
      const $snippetRow = $row.next('tr');
      let ementa = '';
      if ($snippetRow.length > 0) {
        const $snippetTd = $snippetRow.find('td[colspan]');
        if ($snippetTd.length > 0) {
          // Remove highlight spans but keep their text content
          $snippetTd.find('span.texto-resultado-busca').each((_, span) => {
            $(span).replaceWith($(span).text());
          });
          ementa = cleanEmentaText($snippetTd.text());
        }
      }

      // Build the decision number from the PDF filename or process number
      let decisionNumber = '';

      // Try to extract number from PDF URL (e.g. .../pdf/12345.pdf -> 12345)
      const pdfMatch = pdfUrl.match(/\/(\d+)\.pdf/i);
      if (pdfMatch) {
        decisionNumber = pdfMatch[1];
      } else if (processNumber) {
        // Use process number as fallback
        decisionNumber = processNumber.replace(/\//g, '-');
      } else {
        decisionNumber = `unknown-${i}`;
      }

      // Build title from available info
      const titleParts: string[] = [];
      if (docType) titleParts.push(docType);
      if (processNumber) titleParts.push(`- Proc. ${processNumber}`);
      if (materia) titleParts.push(`- ${materia}`);
      const title = titleParts.join(' ') || `Decisao TCE-SP ${decisionNumber}`;

      // Build URL: prefer PDF link, fallback to process detail page
      let url = '';
      if (pdfUrl) {
        url = pdfUrl.startsWith('http') ? pdfUrl : `${PDF_BASE_URL}/${pdfUrl}`;
      } else if (procHref) {
        url = procHref.startsWith('http') ? procHref : `${BASE_URL}/jurisprudencia/${procHref}`;
      }

      // Build ementa: combine snippet with metadata for context
      const ementaParts: string[] = [];
      if (ementa) ementaParts.push(ementa);
      if (!ementa) {
        // If no snippet, build from metadata
        if (objeto) ementaParts.push(`Objeto: ${objeto}`);
        if (materia) ementaParts.push(`Materia: ${materia}`);
        if (parte1) ementaParts.push(`Parte 1: ${parte1}`);
        if (parte2) ementaParts.push(`Parte 2: ${parte2}`);
      }

      const decision: RawDecision = {
        decisionNumber,
        title,
        ementa: ementaParts.join('. ') || title,
        dataJulgamento: autuacao || undefined,
        url: url || undefined,
        processNumber: processNumber || undefined,
      };

      decisions.push(decision);
    });

    console.log(`[${SCRAPER_CODE}] Parsed ${decisions.length} decisions (total: ${totalResults})`);
    return { decisions, totalResults };
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

    // Generate AI summary for approved decisions
    let summary: string | null = null;
    if (classification.approvalStatus === 'auto_approved') {
      summary = await generateDecisionSummary({ title: raw.title, ementa: raw.ementa });
    }

    const data = {
      tribunalCode: normalizeTribunalCode(SCRAPER_CODE),
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
      url: raw.url || null,
      isRelevant: classification.approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      ...setLeiArticles(classification.leiArticles),
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

export { tceSPScraper };
export default tceSPScraper;
