/**
 * DataJud CNJ Scraper
 * API Elasticsearch publica do CNJ
 * Endpoint: https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search
 * Tribunais: STJ, STF
 * Foco: decisoes paradigmaticas sobre Lei 14.133/2021
 */
import { prisma } from '@/lib/prisma';
import type { TribunalScraper, TribunalScrapeOptions, TribunalScrapeResult, ScraperHealthStatus } from './index';
import { normalizeDecisionNumber, buildFullIdentifier, logScraperHealth, sleep } from './utils';
import { classifyDecision } from './classifier';

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br';
const API_KEY = process.env.DATAJUD_API_KEY || '';

const TRIBUNAIS = [
  { code: 'stj', name: 'STJ', fullName: 'Superior Tribunal de Justica', endpoint: 'api_publica_stj' },
  { code: 'stf', name: 'STF', fullName: 'Supremo Tribunal Federal', endpoint: 'api_publica_stf' },
] as const;

const SEARCH_KEYWORDS = ['lei 14133', 'nova lei de licitações', 'licitação', 'pregão eletrônico'];

interface DataJudHit {
  _source: {
    numeroProcesso: string;
    classe?: { nome?: string; codigo?: number };
    assuntos?: Array<{ nome?: string; codigo?: number }>;
    orgaoJulgador?: { nome?: string };
    dataJulgamento?: string;
    dataPublicacao?: string;
    movimentos?: Array<{ nome?: string; dataHora?: string; complementosTabelados?: Array<{ nome?: string; valor?: string }> }>;
    textoDecisao?: string;
  };
}

class DataJudScraper implements TribunalScraper {
  code: string;
  name: string;
  fullName: string;
  type = 'judicial' as const;
  hasApi = true;
  supportsFullText = true;
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
      const url = `${DATAJUD_BASE}/${this.endpoint}/_search`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'Authorization': `APIKey ${API_KEY}` } : {}),
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

    try {
      // Build date range
      const now = new Date();
      const from = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // last 30 days
      const to = endDate || now;

      for (const keyword of SEARCH_KEYWORDS) {
        if (result.itemsFound >= maxItems) break;

        try {
          const hits = await this.search(keyword, from, to, maxItems - result.itemsFound);

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

          await sleep(1000);
        } catch (error) {
          result.errors.push(`Search failed for "${keyword}": ${error instanceof Error ? error.message : String(error)}`);
        }
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

  private async search(keyword: string, from: Date, to: Date, limit: number): Promise<DataJudHit[]> {
    const url = `${DATAJUD_BASE}/${this.endpoint}/_search`;

    const body = {
      size: Math.min(limit, 20),
      query: {
        bool: {
          must: [
            { match: { 'textoDecisao': keyword } },
          ],
          filter: [
            { range: { dataJulgamento: { gte: from.toISOString().split('T')[0], lte: to.toISOString().split('T')[0] } } },
          ],
        },
      },
      sort: [{ dataJulgamento: { order: 'desc' } }],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'Authorization': `APIKey ${API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`DataJud API returned ${response.status}`);
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

    const title = `${src.classe?.nome || 'Decisao'} ${processNumber} - ${this.name}`;
    const ementa = src.textoDecisao?.slice(0, 5000) || `${src.classe?.nome || ''} - ${src.assuntos?.map(a => a.nome).join(', ') || ''}`;

    // Classify
    const classification = await classifyDecision({ title, ementa, decisionType: src.classe?.nome });

    const year = src.dataJulgamento ? new Date(src.dataJulgamento).getFullYear() : new Date().getFullYear();

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
        ementa: ementa.slice(0, 10000),
        orgaoJulgador: src.orgaoJulgador?.nome || null,
        dataJulgamento: src.dataJulgamento ? new Date(src.dataJulgamento) : null,
        dataPublicacao: src.dataPublicacao ? new Date(src.dataPublicacao) : null,
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

// Create scraper instances for each tribunal
export const dataJudSTJScraper = new DataJudScraper(TRIBUNAIS[0]);
export const dataJudSTFScraper = new DataJudScraper(TRIBUNAIS[1]);
