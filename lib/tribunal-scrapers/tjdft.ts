/**
 * TJDFT Scraper — JurisDF (pesquisa de jurisprudência do TJDFT)
 *
 * API: POST https://jurisdf.tjdft.jus.br/api/v1/pesquisa (JSON aberto).
 * Corpo: { query, termosAcessorios: [{campo, valor}], pagina, tamanho (máx. 40),
 * espelho, inteiroTeor, sinonimos, retornaInteiroTeor, retornaTotalizacao }.
 * Filtros usados: base = acordaos e dataJulgamento = "entre AAAA-MM-DD e AAAA-MM-DD".
 * Link público: https://jurisdf.tjdft.jus.br/acordaos/<uuid>.
 *
 * Volume medido: ~25 acórdãos/mês com "licitação" (ago/2026).
 */

import { prisma } from '@/lib/prisma';
import type { TribunalScraper, TribunalScrapeOptions, TribunalScrapeResult, ScraperHealthStatus } from './index';
import { buildFullIdentifier, normalizeTribunalCode, logScraperHealth } from './utils';
import { classifyDecision, generateDecisionSummary } from './classifier';
import { setLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from '@/lib/logger';

const SCRAPER_CODE = 'tjdft';
const API_URL = 'https://jurisdf.tjdft.jus.br/api/v1/pesquisa';
const LINK_ACORDAO = 'https://jurisdf.tjdft.jus.br/acordaos/';
const TERMOS = ['licitação', '"contrato administrativo"'];
const POR_PAGINA = 40; // máximo aceito pela API
const MAX_PAGINAS = 100;
const DIAS_JANELA = 45;
const TEMPO_PROCESSAMENTO_MS = 60_000;
// Crimes licitatórios entram (decisão editorial de 26/09/2026).
const RE_TEMA = /licita|contratos? administrativ/i;

export interface TjdftRegistro {
  uuid?: string;
  identificador?: string;
  dataJulgamento?: string;
  ementa?: string;
  decisao?: string;
  processo?: string;
  nomeRelator?: string;
  descricaoOrgaoJulgador?: string;
  segredoJustica?: boolean;
}

export interface DecisaoTjdft {
  numero: string;
  uuid: string;
  title: string;
  ementa: string;
  decisao?: string;
  processNumber?: string;
  relator?: string;
  orgaoJulgador?: string;
  dataJulgamento?: Date;
}

export function registroParaDecisao(r: TjdftRegistro): DecisaoTjdft {
  const numero = String(r.identificador || '').trim();
  const data = r.dataJulgamento ? new Date(r.dataJulgamento) : undefined;
  return {
    numero,
    uuid: (r.uuid || '').trim(),
    title: `Acórdão ${numero} TJDFT`,
    ementa: (r.ementa || '').replace(/\s+\n/g, '\n').trim(),
    decisao: r.decisao?.trim() || undefined,
    processNumber: r.processo?.trim() || undefined,
    relator: r.nomeRelator?.trim() || undefined,
    orgaoJulgador: r.descricaoOrgaoJulgador?.trim() || undefined,
    dataJulgamento: data && !Number.isNaN(data.getTime()) ? data : undefined,
  };
}

export function noRecorteTjdft(r: TjdftRegistro, d: DecisaoTjdft): boolean {
  return !r.segredoJustica && RE_TEMA.test(d.ementa);
}

export function montarCorpoTjdft(o: { termo: string; inicio: string; fim: string; pagina: number }): object {
  return {
    query: o.termo,
    termosAcessorios: [
      { campo: 'base', valor: 'acordaos' },
      { campo: 'dataJulgamento', valor: `entre ${o.inicio} e ${o.fim}` },
    ],
    pagina: o.pagina,
    tamanho: POR_PAGINA,
    espelho: true,
    inteiroTeor: false,
    sinonimos: true,
    retornaInteiroTeor: false,
    retornaTotalizacao: true,
  };
}

async function buscar(termo: string, inicio: string, fim: string): Promise<TjdftRegistro[]> {
  const todos: TjdftRegistro[] = [];
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (sitedobarral jurisprudencia)' },
      body: JSON.stringify(montarCorpoTjdft({ termo, inicio, fim, pagina: p })),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`JurisDF/TJDFT HTTP ${r.status}`);
    const j = (await r.json()) as { hits?: { value?: number }; registros?: TjdftRegistro[] };
    const lote = j.registros || [];
    todos.push(...lote);
    if (lote.length < POR_PAGINA || todos.length >= (j.hits?.value ?? 0)) break;
  }
  return todos;
}

export interface OpcoesTjdft extends TribunalScrapeOptions {
  desde?: Date;
  tempoMaxMs?: number;
}

class TJDFTScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TJDFT';
  fullName = 'Tribunal de Justiça do Distrito Federal e dos Territórios';
  type = 'judicial' as const;
  hasApi = true;
  supportsFullText = false;
  agendaPropria = true;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(montarCorpoTjdft({ termo: 'licitação', inicio: hoje, fim: hoje, pagina: 0 })) });
      return { scraperCode: SCRAPER_CODE, isHealthy: r.ok, consecutiveFailures: r.ok ? 0 : 1, message: `HTTP ${r.status}` };
    } catch (error) {
      return { scraperCode: SCRAPER_CODE, isHealthy: false, consecutiveFailures: 1, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async scrape(options: OpcoesTjdft = {}): Promise<TribunalScrapeResult> {
    const inicio = Date.now();
    const { maxItems = 100, forceRescrape = false, tempoMaxMs = TEMPO_PROCESSAMENTO_MS } = options;
    const desde = (options.desde ?? new Date(Date.now() - DIAS_JANELA * 864e5)).toISOString().slice(0, 10);
    const ate = new Date().toISOString().slice(0, 10);
    const result: TribunalScrapeResult = { scraperCode: SCRAPER_CODE, itemsFound: 0, itemsNew: 0, itemsSkipped: 0, itemsError: 0, errors: [], duration: 0 };

    try {
      const porUuid = new Map<string, DecisaoTjdft>();
      let brutos = 0;
      for (const termo of TERMOS) {
        const regs = await buscar(termo, desde, ate);
        brutos += regs.length;
        for (const r of regs) {
          const d = registroParaDecisao(r);
          if (d.uuid && d.numero && noRecorteTjdft(r, d)) porUuid.set(d.uuid, d);
        }
      }
      const decisoes = [...porUuid.values()];
      result.itemsFound = decisoes.length;

      const id = (d: DecisaoTjdft) => buildFullIdentifier(SCRAPER_CODE, 'acordao', d.numero);
      const jaGravados = await prisma.tribunalDecision.findMany({ where: { fullIdentifier: { in: decisoes.map(id) } }, select: { fullIdentifier: true } });
      const existentes = new Set(jaGravados.map((d) => d.fullIdentifier));
      const aProcessar = decisoes
        .filter((d) => forceRescrape || !existentes.has(id(d)))
        .sort((a, b) => (b.dataJulgamento?.getTime() ?? 0) - (a.dataJulgamento?.getTime() ?? 0))
        .slice(0, maxItems);
      result.itemsSkipped = decisoes.length - aProcessar.length;

      let processados = 0;
      for (const d of aProcessar) {
        if (Date.now() - inicio > tempoMaxMs) break;
        processados++;
        try {
          await this.gravar(d, id(d), existentes.has(id(d)), result);
        } catch (error) {
          result.itemsError++;
          result.errors.push(`${d.numero}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      result.duration = Date.now() - inicio;
      await logScraperHealth(SCRAPER_CODE, result.errors.length > 0 ? 'partial_failure' : 'success', {
        itemsFound: result.itemsFound,
        itemsNew: result.itemsNew,
        itemsError: result.itemsError,
        duration: result.duration,
        errorMessage: result.errors.length > 0 ? result.errors.slice(0, 10).join('; ') : undefined,
        metadata: { brutos, noRecorte: decisoes.length, jaGravados: existentes.size, processados, desde },
      });
    } catch (error) {
      result.duration = Date.now() - inicio;
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(msg);
      apiLogger.error({ err: msg }, `[${SCRAPER_CODE}] falhou`);
      await logScraperHealth(SCRAPER_CODE, 'failure', { duration: result.duration, errorMessage: msg });
    }
    return result;
  }

  private async gravar(d: DecisaoTjdft, fullIdentifier: string, existe: boolean, result: TribunalScrapeResult): Promise<void> {
    const classification = await classifyDecision({ title: d.title, ementa: d.ementa, decisionType: 'acordao', tribunalCode: 'TJDFT' });
    const summary =
      classification.approvalStatus === 'auto_approved'
        ? await generateDecisionSummary({ title: d.title, ementa: d.ementa, tribunalCode: 'TJDFT' })
        : null;
    const data = {
      tribunalCode: normalizeTribunalCode('TJDFT'),
      tribunalName: this.fullName,
      decisionType: 'acordao',
      decisionNumber: d.numero,
      processNumber: d.processNumber || null,
      year: d.dataJulgamento?.getUTCFullYear() ?? new Date().getFullYear(),
      fullIdentifier,
      title: d.title,
      ementa: d.ementa,
      summary,
      relator: d.relator || null,
      orgaoJulgador: d.orgaoJulgador || null,
      dataJulgamento: d.dataJulgamento || null,
      url: `${LINK_ACORDAO}${d.uuid}`,
      isRelevant: classification.approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      ...setLeiArticles(classification.leiArticles),
      suggestedCourses: classification.suggestedCourses,
      sourceApi: 'tjdft-jurisdf',
      approvalStatus: classification.approvalStatus,
      confidence: classification.confidence,
      classificationReasoning: [classification.reasoning, d.decisao ? `Decisão: ${d.decisao}` : null].filter(Boolean).join('; '),
    };
    if (existe) {
      await prisma.tribunalDecision.update({ where: { fullIdentifier }, data });
    } else {
      await prisma.tribunalDecision.create({ data });
      result.itemsNew++;
    }
  }
}

const tjdftScraper = new TJDFTScraper();

export { tjdftScraper };
export default tjdftScraper;
