/**
 * DataJud CNJ Scraper
 * API Elasticsearch publica do CNJ
 * Endpoint: https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search
 * Tribunal: STJ (STF nao esta disponivel na API publica)
 * Foco: decisoes sobre licitacoes e contratos administrativos
 *
 * A API publica retorna apenas metadados (capa processual), nao o inteiro teor.
 * Busca por codigos de assunto CNJ (descobertos via API 2026-02-20):
 *   10385 = Licitacoes
 *   14914 = Contrato Administrativo
 *   14138 = Pregao
 *   14131 = Dispensa
 *   14132 = Inexigibilidade
 *   14133 = Concorrencia
 *   14134 = Tomada de Preco
 *   10392 = Convenio
 */
import { prisma } from '@/lib/prisma';
import type { TribunalScraper, TribunalScrapeOptions, TribunalScrapeResult, ScraperHealthStatus } from './index';
import { normalizeDecisionNumber, buildFullIdentifier, logScraperHealth, sleep } from './utils';
import { classifyDecision, generateDecisionSummary } from './classifier';

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br';
const API_KEY = process.env.DATAJUD_API_KEY || '';

const TRIBUNAIS = [
  { code: 'stj', name: 'STJ', fullName: 'Superior Tribunal de Justica', endpoint: 'api_publica_stj' },
] as const;

// Codigos de assunto CNJ relacionados a licitacoes e contratos
// Descobertos via busca na API publica do DataJud (2026-02-20)
const ASSUNTO_CODES = [
  10385, // Licitacoes
  14914, // Contrato Administrativo
  14138, // Pregao
  14131, // Dispensa (de Licitacao)
  14132, // Inexigibilidade
  14133, // Concorrencia
  14134, // Tomada de Preco
  10392, // Convenio
];

interface DataJudHit {
  _source: {
    numeroProcesso: string;
    classe?: { nome?: string; codigo?: number };
    assuntos?: Array<{ nome?: string; codigo?: number }>;
    orgaoJulgador?: { nome?: string };
    dataAjuizamento?: string;
    dataHoraUltimaAtualizacao?: string;
    movimentos?: Array<{ nome?: string; dataHora?: string; complementosTabelados?: Array<{ nome?: string; valor?: string }> }>;
  };
}

class DataJudScraper implements TribunalScraper {
  code: string;
  name: string;
  fullName: string;
  type = 'judicial' as const;
  hasApi = true;
  supportsFullText = false; // API so retorna metadados, nao inteiro teor
  private endpoint: string;

  constructor(tribunal: typeof TRIBUNAIS[number]) {
    this.code = tribunal.code;
    this.name = tribunal.name;
    this.fullName = tribunal.fullName;
    this.endpoint = tribunal.endpoint;
  }

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === this.code;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      if (!API_KEY) {
        return {
          scraperCode: this.code,
          isHealthy: false,
          consecutiveFailures: 1,
          message: 'DATAJUD_API_KEY nao configurada',
        };
      }

      const url = `${DATAJUD_BASE}/${this.endpoint}/_search`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `APIKey ${API_KEY}`,
        },
        body: JSON.stringify({ size: 1, query: { match_all: {} } }),
        signal: AbortSignal.timeout(15000),
      });

      const lastLog = await prisma.scraperHealthLog.findFirst({
        where: { scraperCode: this.code },
        orderBy: { runAt: 'desc' },
      });

      return {
        scraperCode: this.code,
        isHealthy: response.ok,
        lastRun: lastLog?.runAt || undefined,
        lastSuccess: lastLog?.status === 'success' ? lastLog.runAt : undefined,
        consecutiveFailures: lastLog?.status === 'failure' ? 1 : 0,
        message: response.ok ? 'API acessivel' : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        scraperCode: this.code,
        isHealthy: false,
        consecutiveFailures: 1,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async scrape(options: TribunalScrapeOptions = {}): Promise<TribunalScrapeResult> {
    const startTime = Date.now();
    const { maxItems = 50, startDate, endDate } = options;

    const result: TribunalScrapeResult = {
      scraperCode: this.code,
      itemsFound: 0, itemsNew: 0, itemsSkipped: 0, itemsError: 0,
      errors: [], duration: 0,
    };

    if (!API_KEY) {
      result.errors.push('DATAJUD_API_KEY nao configurada');
      result.duration = Date.now() - startTime;
      await logScraperHealth(this.code, 'failure', {
        duration: result.duration, errorMessage: result.errors[0],
      });
      return result;
    }

    try {
      // Build date range
      const now = new Date();
      const from = startDate || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // last 90 days
      const to = endDate || now;

      // Busca por codigos de assunto CNJ (uma query com todos os codigos)
      try {
        const hits = await this.searchByAssuntoCodes(from, to, maxItems);

        for (const hit of hits) {
          try {
            const wasNew = await this.processHit(hit);
            result.itemsFound++;
            if (wasNew) result.itemsNew++;
            else result.itemsSkipped++;
          } catch (error) {
            result.itemsError++;
            result.errors.push(`Error processing hit: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } catch (error) {
        result.errors.push(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      result.duration = Date.now() - startTime;
      await logScraperHealth(this.code, result.errors.length > 0 ? 'partial_failure' : 'success', {
        itemsFound: result.itemsFound, itemsNew: result.itemsNew,
        itemsError: result.itemsError, duration: result.duration,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      });
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.errors.push(error instanceof Error ? error.message : String(error));
      await logScraperHealth(this.code, 'failure', {
        duration: result.duration, errorMessage: result.errors[0],
      });
    }

    return result;
  }

  private async searchByAssuntoCodes(from: Date, to: Date, limit: number): Promise<DataJudHit[]> {
    const url = `${DATAJUD_BASE}/${this.endpoint}/_search`;

    const body = {
      size: Math.min(limit, 20),
      query: {
        bool: {
          must: [
            { terms: { 'assuntos.codigo': ASSUNTO_CODES } },
          ],
        },
      },
      sort: [{ '@timestamp': { order: 'desc' } }],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `APIKey ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`DataJud API returned ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    return (data.hits?.hits || []) as DataJudHit[];
  }

  private async processHit(hit: DataJudHit): Promise<boolean> {
    const src = hit._source;
    const processNumber = src.numeroProcesso || 'unknown';
    const normalized = normalizeDecisionNumber(processNumber);
    const fullIdentifier = buildFullIdentifier(this.code, 'decisao', normalized);

    // Check duplicate
    const existing = await prisma.tribunalDecision.findUnique({ where: { fullIdentifier } });
    if (existing) return false;

    const assuntosText = src.assuntos?.map(a => a.nome).filter(Boolean).join(', ') || '';
    const title = `${src.classe?.nome || 'Decisao'} ${processNumber} - ${this.name}`;
    const ementa = `${src.classe?.nome || ''} - ${assuntosText} - ${src.orgaoJulgador?.nome || ''}`.trim();

    // Build summary from last movements
    const lastMovements = (src.movimentos || []).slice(-3).map(m => m.nome).filter(Boolean).join('; ');
    const fullEmenta = lastMovements ? `${ementa}. Movimentos: ${lastMovements}` : ementa;

    // Classify
    const classification = await classifyDecision({ title, ementa: fullEmenta, decisionType: src.classe?.nome });

    // Generate AI summary for approved decisions
    let summary: string | null = null;
    if (classification.approvalStatus === 'auto_approved') {
      summary = await generateDecisionSummary({ title, ementa: fullEmenta, decisionType: src.classe?.nome });
    }

    // Parse dates safely — avoid Invalid Date
    const parseDate = (val: unknown): Date | null => {
      if (!val || typeof val !== 'string') return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    // DataJud não fornece dataJulgamento explícita; dataAjuizamento é usada como aproximação
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataJulgamento = parseDate((src as any).dataJulgamento) || parseDate(src.dataAjuizamento);
    const dataPublicacao = parseDate(src.dataHoraUltimaAtualizacao);
    const year = dataJulgamento ? dataJulgamento.getFullYear() : (dataPublicacao ? dataPublicacao.getFullYear() : new Date().getFullYear());

    // Construct URL to STJ process search (CNJ unified numbering)
    const processUrl = processNumber
      ? `https://processo.stj.jus.br/processo/pesquisa/?aplicacao=processos.ea&tipoPesquisa=tipoPesquisaGenerica&termo=${encodeURIComponent(processNumber)}`
      : null;

    await prisma.tribunalDecision.create({
      data: {
        tribunalCode: this.code,
        tribunalName: this.fullName,
        decisionType: 'decisao',
        decisionNumber: normalized,
        processNumber,
        year,
        fullIdentifier,
        title,
        ementa: fullEmenta.slice(0, 10000),
        summary,
        url: processUrl,
        orgaoJulgador: src.orgaoJulgador?.nome || null,
        dataJulgamento,
        dataPublicacao,
        isRelevant: classification.approvalStatus !== 'auto_rejected',
        relevanceScore: classification.relevanceScore,
        themes: JSON.stringify(classification.themes),
        leiArticles: JSON.stringify(classification.leiArticles),
        suggestedCourses: classification.suggestedCourses,
        sourceApi: `datajud-${this.code}`,
        approvalStatus: classification.approvalStatus,
        confidence: classification.confidence,
        classificationReasoning: classification.reasoning,
      },
    });

    return true;
  }
}

// STJ scraper instance (STF nao esta disponivel na API publica do DataJud)
export const dataJudSTJScraper = new DataJudScraper(TRIBUNAIS[0]);
