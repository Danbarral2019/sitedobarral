/**
 * TCE-PR Scraper — Dados Abertos (CSV)
 *
 * Tribunal de Contas do Estado do Parana
 * URL: https://viajuris.tce.pr.gov.br/
 *
 * Usa arquivos CSV dos Dados Abertos do TCE-PR em vez de scraping HTML.
 * CSV disponivel por ano em:
 *   https://viajuris.tce.pr.gov.br/DadosAbertos/DadosAbertos/DownloadArquivo?nomeArquivo=YYYY_acordaos_base_de_dados.csv
 *
 * CSV: UTF-8 com BOM, delimitador `;`, 24 colunas:
 *   DsTipoAto;NrAto;AnoAto;SgUnidAdm;DsClasseProcessual;DsSubClasseProcessual;
 *   NrProcesso;AnoProcesso;DsTitulo;DsResumo;NmCategoriaPublicacao;DsColegiado;
 *   DsEntidade;DsInteressado;DsVeiculoPublicacao;NmAdvogados;DtPublicacaoDOE;
 *   DtSessao;NrDOE;NmRelator;Termos;ReferenciaLegislativas;DsTema;UrlPDF
 */

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

const SCRAPER_CODE = 'tce-pr';
const BASE_URL = 'https://viajuris.tce.pr.gov.br';
const DADOS_ABERTOS_URL = `${BASE_URL}/DadosAbertos/DadosAbertos/DownloadArquivo`;
const HEALTH_CHECK_URL = BASE_URL;

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

/** Represents a single parsed row from the CSV */
interface CSVRow {
  DsTipoAto: string;
  NrAto: string;
  AnoAto: string;
  SgUnidAdm: string;
  DsClasseProcessual: string;
  DsSubClasseProcessual: string;
  NrProcesso: string;
  AnoProcesso: string;
  DsTitulo: string;
  DsResumo: string;
  NmCategoriaPublicacao: string;
  DsColegiado: string;
  DsEntidade: string;
  DsInteressado: string;
  DsVeiculoPublicacao: string;
  NmAdvogados: string;
  DtPublicacaoDOE: string;
  DtSessao: string;
  NrDOE: string;
  NmRelator: string;
  Termos: string;
  ReferenciaLegislativas: string;
  DsTema: string;
  UrlPDF: string;
}

const CSV_COLUMNS: (keyof CSVRow)[] = [
  'DsTipoAto', 'NrAto', 'AnoAto', 'SgUnidAdm', 'DsClasseProcessual',
  'DsSubClasseProcessual', 'NrProcesso', 'AnoProcesso', 'DsTitulo', 'DsResumo',
  'NmCategoriaPublicacao', 'DsColegiado', 'DsEntidade', 'DsInteressado',
  'DsVeiculoPublicacao', 'NmAdvogados', 'DtPublicacaoDOE', 'DtSessao',
  'NrDOE', 'NmRelator', 'Termos', 'ReferenciaLegislativas', 'DsTema', 'UrlPDF',
];

// ===========================
// CSV Parsing (no external libs)
// ===========================

/**
 * Parse a CSV line that uses semicolon delimiter and may have quoted fields.
 * Handles:
 * - Fields wrapped in double quotes (e.g., "value with ; inside")
 * - Escaped double quotes inside quoted fields (e.g., "He said ""hello""")
 * - Trailing whitespace inside quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ';') {
        fields.push(current.trim());
        current = '';
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // Push the last field
  fields.push(current.trim());

  return fields;
}

/**
 * Parse the full CSV text into an array of CSVRow objects.
 * Skips the BOM if present and the header row.
 */
function parseCSV(csvText: string): CSVRow[] {
  // Remove BOM if present
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Skip header row (line 0)
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    // Build row object mapping columns to values
    const row: Record<string, string> = {};
    for (let j = 0; j < CSV_COLUMNS.length; j++) {
      row[CSV_COLUMNS[j]] = (fields[j] || '').trim();
    }

    rows.push(row as unknown as CSVRow);
  }

  return rows;
}

/**
 * Extract the date part from DtSessao format "DD/MM/YYYY HH:MM:SS" or "DD/MM/YYYY"
 */
function extractDatePart(dtSessao: string): string | undefined {
  if (!dtSessao) return undefined;
  // Take only the date portion before any space
  const datePart = dtSessao.split(' ')[0];
  // Validate DD/MM/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(datePart)) {
    return datePart;
  }
  return undefined;
}

// ===========================
// TCE-PR Scraper Implementation
// ===========================

class TCEPRScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCE-PR';
  fullName = 'Tribunal de Contas do Estado do Parana';
  type = 'tce' as const;
  hasApi = true;
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
        message: response.ok ? 'Site acessivel (Dados Abertos CSV)' : `HTTP ${response.status}`,
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
      // Download CSV for current year and previous year
      const currentYear = new Date().getFullYear();
      const yearsToFetch = [currentYear, currentYear - 1];
      const allRows: CSVRow[] = [];

      for (const year of yearsToFetch) {
        try {
          const rows = await this.downloadCSV(year);
          allRows.push(...rows);
          console.log(`[${SCRAPER_CODE}] Downloaded ${rows.length} rows for year ${year}`);
          await sleep(1000); // Brief delay between downloads
        } catch (error) {
          const msg = `CSV download failed for ${year}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(msg);
          console.error(`[${SCRAPER_CODE}]`, msg);
        }
      }

      if (allRows.length === 0) {
        throw new Error('No CSV data downloaded for any year');
      }

      // Filter rows by relevance to search terms
      const filtered = this.filterBySearchTerms(allRows, searchTerms);
      console.log(`[${SCRAPER_CODE}] Filtered ${filtered.length} relevant rows from ${allRows.length} total`);

      // Convert CSV rows to RawDecision format
      const decisions = filtered.map(row => this.csvRowToDecision(row));

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
          totalCSVRows: allRows.length,
          filteredRows: filtered.length,
          source: 'dados-abertos-csv',
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
  // CSV Download
  // ===========================

  private async downloadCSV(year: number): Promise<CSVRow[]> {
    const fileName = `${year}_acordaos_base_de_dados.csv`;
    const url = `${DADOS_ABERTOS_URL}?nomeArquivo=${fileName}`;

    const response = await fetchWithRetry(url, {
      timeoutMs: 60000, // 60s — CSV files can be large
      maxRetries: 2,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${fileName}`);
    }

    const csvText = await response.text();

    if (!csvText || csvText.length < 100) {
      throw new Error(`Empty or too small CSV for ${year}`);
    }

    return parseCSV(csvText);
  }

  // ===========================
  // Filter by search terms
  // ===========================

  private filterBySearchTerms(rows: CSVRow[], searchTerms: string[]): CSVRow[] {
    const termsLower = searchTerms.map(t => t.toLowerCase());

    return rows.filter(row => {
      // Combine searchable fields into one lowercase string
      const searchable = [
        row.DsResumo,
        row.DsTitulo,
        row.DsClasseProcessual,
        row.DsSubClasseProcessual,
        row.DsTema,
        row.Termos,
        row.ReferenciaLegislativas,
        row.DsEntidade,
      ]
        .join(' ')
        .toLowerCase();

      return termsLower.some(term => searchable.includes(term));
    });
  }

  // ===========================
  // CSV Row → RawDecision
  // ===========================

  private csvRowToDecision(row: CSVRow): RawDecision {
    const nrAto = row.NrAto.trim();
    const anoAto = row.AnoAto.trim();
    const decisionNumber = nrAto && anoAto ? `${nrAto}/${anoAto}` : nrAto || 'unknown';

    const nrProcesso = row.NrProcesso.trim();
    const anoProcesso = row.AnoProcesso.trim();
    const processNumber = nrProcesso && anoProcesso
      ? `${nrProcesso}/${anoProcesso}`
      : nrProcesso || undefined;

    const urlPDF = row.UrlPDF.trim();

    return {
      decisionNumber,
      title: row.DsTitulo.trim() || `Acordao ${decisionNumber} TCE-PR`,
      ementa: row.DsResumo.trim(),
      relator: row.NmRelator.trim() || undefined,
      orgaoJulgador: row.DsColegiado.trim() || undefined,
      dataJulgamento: extractDatePart(row.DtSessao),
      url: urlPDF || undefined,
      processNumber,
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
      sourceApi: 'tce-pr-dados-abertos',
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

const tcePRScraper = new TCEPRScraper();
registerScraper(tcePRScraper);

export { tcePRScraper };
export default tcePRScraper;
