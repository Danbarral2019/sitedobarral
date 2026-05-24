/**
 * TCE-RJ Scraper — Dados Abertos API (Penalidades + Licitacoes)
 *
 * Tribunal de Contas do Estado do Rio de Janeiro
 * URL: https://www.tcerj.tc.br
 *
 * O portal de jurisprudencia (sistema-jurisprudencia) esta em manutencao.
 * Enquanto indisponivel, usa a API de Dados Abertos publica:
 *   https://dados.tcerj.tc.br/api/v1/
 *
 * Endpoints usados:
 *   GET /penalidades_ressarcimento_municipio?tipo=multa|debito&jsonfull=true
 *   GET /penalidades_ressarcimento_estado?tipo=multa|debito&jsonfull=true
 *
 * Penalidades contem decisoes do TCE-RJ sobre multas e debitos
 * aplicados a entes municipais/estaduais, com numero de processo,
 * natureza (licitacao, contrato, etc.), e data da sessao.
 *
 * Nota: JSON retornado com UTF-8 BOM — tratado no fetch.
 * Quando o portal voltar, este scraper sera atualizado para usar
 * o endpoint de jurisprudencia completo.
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
  normalizeTribunalCode,
  extractYear,
  logScraperHealth,
  sleep,
} from './utils';
import { classifyDecision, generateDecisionSummary } from './classifier';
import { setLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from "@/lib/logger";

// ===========================
// Constants
// ===========================

const SCRAPER_CODE = 'tce-rj';
const API_BASE = 'https://dados.tcerj.tc.br/api/v1';
const JURISPRUDENCIA_URL = 'https://www.tcerj.tc.br/sistema-jurisprudencia/public/';

/** Penalty endpoints to fetch */
const PENALTY_SOURCES = [
  { endpoint: 'penalidades_ressarcimento_municipio', tipo: 'multa', esfera: 'municipal' },
  { endpoint: 'penalidades_ressarcimento_municipio', tipo: 'debito', esfera: 'municipal' },
  { endpoint: 'penalidades_ressarcimento_estado', tipo: 'multa', esfera: 'estadual' },
  { endpoint: 'penalidades_ressarcimento_estado', tipo: 'debito', esfera: 'estadual' },
] as const;

/** GrupoNatureza values relevant to licitacoes/contratos */
const RELEVANT_NATUREZA = new Set([
  'CONTRATO',
  'ATO DE DISPENSA DE LICITAÇÃO',
  'ATO DE INEXIGIBILIDADE DE LICITAÇÃO',
  'ATA DE REGISTRO DE PREÇOS',
  'EDITAL DE LICITAÇÃO',
  'ATO DE ADESÃO A ATAS DE REGISTRO DE PREÇOS',
  'REPRESENTAÇÃO',
  'REPRESENTAÇÃO DA SGE',
]);

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

interface PenaltyItem {
  Processo?: string;
  AnoCondenacao?: number;
  Tipo?: string;
  ValorPenalidade?: number;
  Condenacao?: string;
  Ente?: string;
  TipoEnte?: string;
  NomeOrgao?: string;
  GrupoNatureza?: string;
  DataSessao?: number;
  DataUltimaAtualizacao?: number;
  [key: string]: unknown;
}

// ===========================
// TCE-RJ Scraper Implementation
// ===========================

class TCERJScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCE-RJ';
  fullName = 'Tribunal de Contas do Estado do Rio de Janeiro';
  type = 'tce' as const;
  hasApi = true;
  supportsFullText = false;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      // Check Open Data API
      const apiUrl = `${API_BASE}/penalidades_ressarcimento_municipio?tipo=multa&limite=1&jsonfull=true`;
      const apiResponse = await fetchWithRetry(apiUrl, {
        timeoutMs: 15000,
        maxRetries: 1,
        headers: { 'Accept': 'application/json' },
      });

      // Also check if jurisprudence portal is back
      let portalOnline = false;
      try {
        const portalResponse = await fetchWithRetry(JURISPRUDENCIA_URL, {
          timeoutMs: 10000,
          maxRetries: 1,
        });
        const portalText = await portalResponse.text();
        // Portal redirects to maintenance page — check if response contains "manutencao"
        portalOnline = portalResponse.ok && !portalText.includes('manutencao') && !portalText.includes('manutenção');
      } catch {
        // Portal still down
      }

      const lastLog = await prisma.scraperHealthLog.findFirst({
        where: { scraperCode: SCRAPER_CODE },
        orderBy: { runAt: 'desc' },
      });

      const portalMsg = portalOnline
        ? 'Portal jurisprudencia ONLINE'
        : 'Portal jurisprudencia em manutencao';

      return {
        scraperCode: SCRAPER_CODE,
        isHealthy: apiResponse.ok,
        lastRun: lastLog?.runAt || undefined,
        lastSuccess: lastLog?.status === 'success' ? lastLog.runAt : undefined,
        consecutiveFailures: lastLog?.status === 'failure' ? 1 : 0,
        message: apiResponse.ok
          ? `API Dados Abertos acessivel. ${portalMsg}`
          : `HTTP ${apiResponse.status}. ${portalMsg}`,
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
      const allItems: PenaltyItem[] = [];
      const seenKeys = new Set<string>();

      // Fetch from all 4 penalty sources
      for (const source of PENALTY_SOURCES) {
        try {
          const items = await this.fetchPenalties(source.endpoint, source.tipo);

          for (const item of items) {
            const key = `${item.Processo}-${item.Condenacao}-${source.tipo}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              allItems.push(item);
            }
          }

          console.log(`[${SCRAPER_CODE}] Fetched ${items.length} ${source.tipo}s ${source.esfera} (total: ${allItems.length})`);
          await sleep(1000);
        } catch (error) {
          const msg = `Fetch failed for ${source.endpoint}/${source.tipo}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(msg);
          apiLogger.error({ err: msg }, `[${SCRAPER_CODE}]`);
        }
      }

      if (allItems.length === 0) {
        throw new Error('No penalty data from Dados Abertos API');
      }

      // Filter by relevant GrupoNatureza + recent years
      const currentYear = new Date().getFullYear();
      const filtered = allItems.filter(item => {
        const natureza = (item.GrupoNatureza || '').trim();
        const ano = item.AnoCondenacao || 0;
        return RELEVANT_NATUREZA.has(natureza) && ano >= currentYear - 1;
      });

      console.log(`[${SCRAPER_CODE}] Filtered ${filtered.length} relevant penalties from ${allItems.length} total`);

      // Convert to RawDecision
      const decisions = filtered.map(item => this.penaltyToDecision(item));

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
          totalPenalties: allItems.length,
          filteredItems: filtered.length,
          source: 'dados-abertos-penalidades',
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
  // Fetch penalties
  // ===========================

  private async fetchPenalties(endpoint: string, tipo: string): Promise<PenaltyItem[]> {
    const url = `${API_BASE}/${endpoint}?tipo=${tipo}&jsonfull=true`;

    const response = await fetchWithRetry(url, {
      timeoutMs: 30000,
      maxRetries: 2,
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${endpoint}/${tipo}`);
    }

    // TCE-RJ API returns JSON with UTF-8 BOM
    const buffer = await response.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buffer);
    // Strip BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      return [];
    }

    return data as PenaltyItem[];
  }

  // ===========================
  // Penalty → RawDecision
  // ===========================

  private penaltyToDecision(item: PenaltyItem): RawDecision {
    const condenacao = (item.Condenacao || '').trim();
    const processo = (item.Processo || '').trim();
    const decisionNumber = condenacao || processo || 'unknown';

    const tipo = (item.Tipo || '').trim();
    const valor = item.ValorPenalidade ? `R$ ${item.ValorPenalidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
    const ente = (item.Ente || '').trim();
    const orgao = (item.NomeOrgao || '').trim();
    const natureza = (item.GrupoNatureza || '').trim();
    const ano = item.AnoCondenacao || '';

    // Construct ementa from available fields
    const ementa = [
      `${tipo} de ${valor}`,
      `aplicada a ${ente}`,
      orgao ? `(${orgao})` : '',
      `em processo de ${natureza.toLowerCase()}`,
      `- Condenacao ${condenacao}`,
      ano ? `(${ano})` : '',
      `- Processo ${processo}`,
    ].filter(Boolean).join(' ').trim();

    // Convert timestamp ms to date string
    let dataJulgamento: string | undefined;
    if (item.DataSessao) {
      const d = new Date(item.DataSessao);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        dataJulgamento = `${dd}/${mm}/${yyyy}`;
      }
    }

    return {
      decisionNumber,
      title: `${tipo} ${condenacao} TCE-RJ — ${natureza}`,
      ementa,
      dataJulgamento,
      processNumber: processo || undefined,
      decisionType: natureza || undefined,
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
    const fullIdentifier = buildFullIdentifier(SCRAPER_CODE, 'decisao', normalized);

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
    const dataJulgamento = raw.dataJulgamento
      ? (() => {
          // Parse DD/MM/YYYY format
          const parts = raw.dataJulgamento.split('/');
          if (parts.length === 3) {
            const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            return isNaN(d.getTime()) ? null : d;
          }
          return null;
        })()
      : null;

    // Generate AI summary for approved decisions
    let summary: string | null = null;
    if (classification.approvalStatus === 'auto_approved') {
      summary = await generateDecisionSummary({ title: raw.title, ementa: raw.ementa, decisionType: raw.decisionType });
    }

    const data = {
      tribunalCode: normalizeTribunalCode(SCRAPER_CODE),
      tribunalName: this.fullName,
      decisionType: 'decisao',
      decisionNumber: normalized,
      processNumber: raw.processNumber || null,
      year,
      fullIdentifier,
      title: raw.title,
      ementa: raw.ementa,
      summary,
      relator: null,
      orgaoJulgador: null,
      dataJulgamento,
      url: null,
      isRelevant: classification.approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      ...setLeiArticles(classification.leiArticles),
      suggestedCourses: classification.suggestedCourses,
      sourceApi: 'tce-rj-dados-abertos',
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

const tceRJScraper = new TCERJScraper();

export { tceRJScraper };
export default tceRJScraper;
