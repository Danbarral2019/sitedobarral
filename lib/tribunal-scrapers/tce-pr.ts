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

/**
 * Orçamento de tempo para processar decisões numa execução. O cron semanal
 * roda os TCEs em sequência dentro de maxDuration = 300 s, e cada decisão
 * aprovada gera resumo no Gemini. O que não couber fica para a semana
 * seguinte: a seleção sempre recomeça pelos mais recentes que faltam.
 */
const TEMPO_PROCESSAMENTO_MS = 90_000;

// ===========================
// CSV Parsing (no external libs)
// ===========================

/**
 * Parse do CSV inteiro (delimitador ';'), campo a campo.
 *
 * Não quebra por linha antes de parsear: o TCE-PR publica resumos com quebra
 * de linha DENTRO de campos entre aspas (75 registros em 2026), e o parser
 * antigo, que dividia o texto por linha, deslocava as colunas desses
 * registros. Trata aspas escapadas (""), BOM e CRLF. Pula o cabeçalho.
 */
export function parseCSV(csvText: string): CSVRow[] {
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const records: string[][] = [];
  let fields: string[] = [];
  let current = '';
  let inQuotes = false;

  const endField = () => {
    fields.push(current);
    current = '';
  };
  const endRecord = () => {
    endField();
    if (fields.some((f) => f.trim() !== '')) records.push(fields);
    fields = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ';') {
      endField();
    } else if (char === '\n') {
      endRecord();
    } else if (char !== '\r') {
      current += char;
    }
  }
  if (current !== '' || fields.length > 0) endRecord();

  // records[0] é o cabeçalho
  return records.slice(1).map((f) => {
    const row: Record<string, string> = {};
    for (let j = 0; j < CSV_COLUMNS.length; j++) {
      row[CSV_COLUMNS[j]] = (f[j] || '').trim();
    }
    return row as unknown as CSVRow;
  });
}

/** Minúsculas e sem diacríticos: "Licitação" e "licitacao" viram a mesma coisa. */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Filtra as linhas relevantes para licitações. Compara SEM acento dos dois
 * lados: os termos padrão (`DEFAULT_SEARCH_TERMS`) são escritos sem acento e
 * o CSV é acentuado, então a comparação literal quase nunca casava (70
 * linhas de 2026 em vez de 239).
 */
export function filtrarPorTermos(rows: CSVRow[], searchTerms: string[]): CSVRow[] {
  const termos = searchTerms.map(semAcento);

  return rows.filter((row) => {
    // Consulta e prejulgado entram sempre (decisões paradigmáticas)
    if (/consulta|prejulgado/.test(semAcento(row.DsClasseProcessual))) {
      return true;
    }

    const pesquisavel = semAcento(
      [
        row.DsResumo,
        row.DsTitulo,
        row.DsClasseProcessual,
        row.DsSubClasseProcessual,
        row.DsTema,
        row.Termos,
        row.ReferenciaLegislativas,
        row.DsEntidade,
      ].join(' '),
    );

    return termos.some((termo) => pesquisavel.includes(termo));
  });
}

/** "DD/MM/YYYY" → número comparável (YYYYMMDD); sem data vai para o fim. */
function chaveData(data?: string): number {
  const m = data?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : 0;
}

/**
 * Escolhe o que processar nesta execução: tira o que já está no banco ANTES
 * de aplicar o limite e começa pelo julgamento mais recente.
 *
 * Antes, o limite era aplicado primeiro sobre o CSV em ordem crescente: a
 * janela era sempre a mesma, já toda gravada, e o scraper passou de
 * 27/04/2026 a 26/09/2026 criando 0 itens por semana com status "success".
 */
export function selecionarParaProcessar<T extends { dataJulgamento?: string }>(
  decisoes: T[],
  chave: (d: T) => string,
  existentes: Set<string>,
  maxItems: number,
  forcar: boolean,
): T[] {
  return decisoes
    .filter((d) => forcar || !existentes.has(chave(d)))
    .sort((x, y) => chaveData(y.dataJulgamento) - chaveData(x.dataJulgamento))
    .slice(0, maxItems);
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
          apiLogger.error({ err: msg }, `[${SCRAPER_CODE}]`);
        }
      }

      if (allRows.length === 0) {
        throw new Error('No CSV data downloaded for any year');
      }

      // Filter rows by relevance to search terms
      const filtered = filtrarPorTermos(allRows, searchTerms);
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

      const identificador = (d: RawDecision) =>
        buildFullIdentifier(SCRAPER_CODE, 'acordao', normalizeDecisionNumber(d.decisionNumber));
      const jaGravados = await prisma.tribunalDecision.findMany({
        where: { fullIdentifier: { in: unique.map(identificador) } },
        select: { fullIdentifier: true },
      });
      const existentes = new Set(jaGravados.map((d) => d.fullIdentifier));
      const aProcessar = selecionarParaProcessar(unique, identificador, existentes, maxItems, forceRescrape);
      result.itemsSkipped = unique.length - aProcessar.length;

      let processados = 0;
      for (const raw of aProcessar) {
        if (Date.now() - startTime > TEMPO_PROCESSAMENTO_MS) break;
        processados++;
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
          jaGravados: existentes.size,
          selecionados: aProcessar.length,
          processados,
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

export { tcePRScraper };
export default tcePRScraper;
