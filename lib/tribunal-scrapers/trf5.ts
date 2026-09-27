/**
 * TRF5 Scraper — Júlia (pesquisa de jurisprudência do TRF da 5ª Região)
 *
 * API: https://juliapesquisa.trf5.jus.br/julia-pesquisa/api/v1/documento:dt/G2
 * (G2 = 2º grau). JSON aberto, sem captcha, aceita até 1.000 por página.
 *
 * Cada item traz o texto do documento de ementa do PJe: cabeçalho do processo,
 * a linha "EMENTA" e a ementa estruturada (caso em exame, questão em
 * discussão, razões de decidir). Os termos pesquisados vêm marcados com <em>.
 * O Júlia não publica link por documento: o texto integral é guardado e
 * exibido na página do site; o link aponta para a pesquisa.
 *
 * Volume medido (ago/2026): ~61 documentos/mês com "licitação" e ~28 com
 * "contrato administrativo", com sobreposição; ~20% são crimes licitatórios.
 */

import { prisma } from '@/lib/prisma';
import type { TribunalScraper, TribunalScrapeOptions, TribunalScrapeResult, ScraperHealthStatus } from './index';
import { buildFullIdentifier, normalizeTribunalCode, logScraperHealth } from './utils';
import { classifyDecision, generateDecisionSummary } from './classifier';
import { setLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from '@/lib/logger';

const SCRAPER_CODE = 'trf5';
const API_URL = 'https://juliapesquisa.trf5.jus.br/julia-pesquisa/api/v1/documento:dt/G2';
const LINK_PESQUISA = 'https://juliapesquisa.trf5.jus.br/julia-pesquisa/pesquisa';
const TERMOS = ['licitação', '"contrato administrativo"'];
const POR_PAGINA = 500;
const MAX_PAGINAS = 20;
const DIAS_JANELA = 45;
const TEMPO_PROCESSAMENTO_MS = 60_000;

// Crimes licitatórios entram (decisão editorial de 26/09/2026): o recorte é
// só temático, pela ementa.
const RE_TEMA = /licita|contratos? administrativ/i;

export interface Trf5Doc {
  codigoDocumento?: string;
  numeroProcesso?: string;
  classeJudicial?: string;
  relator?: string;
  relatorAcordao?: string | null;
  orgaoJulgador?: string;
  dataJulgamento?: string;
  tipoDocumento?: string;
  texto?: string;
}

export interface DecisaoTrf5 {
  codigo: string;
  numeroProcesso: string;
  classe: string;
  title: string;
  ementa: string;
  fullText: string;
  relator?: string;
  orgaoJulgador?: string;
  dataJulgamento?: Date;
}

/** "08004208420214058204" → "0800420-84.2021.4.05.8204" */
export function formatarCnj(n: string): string {
  const d = (n || '').replace(/\D/g, '');
  if (d.length !== 20) return n;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

function limpar(t: string): string {
  return t
    .replace(/<\/?em>/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * A ementa começa na linha "EMENTA" e vai até o dispositivo ("ACÓRDÃO",
 * "Vistos", "RELATÓRIO"), com teto de 4.000 caracteres.
 */
export function extrairEmenta(texto: string): string {
  const t = limpar(texto);
  const ini = t.search(/(^|\n)EMENTA\s*:?\s*\n?/);
  if (ini < 0) return t.slice(0, 2000);
  const corpo = t.slice(ini).replace(/^\n?EMENTA\s*:?\s*/, '');
  const fim = corpo.search(/\n(AC[ÓO]RD[ÃA]O|Vistos|RELAT[ÓO]RIO|Decide a)\b/);
  return (fim > 0 ? corpo.slice(0, fim) : corpo).slice(0, 4000).trim();
}

export function docParaDecisao(d: Trf5Doc): DecisaoTrf5 {
  const numero = formatarCnj(d.numeroProcesso || '');
  const classe = (d.classeJudicial || '').trim();
  const data = d.dataJulgamento ? new Date(`${d.dataJulgamento}T00:00:00Z`) : undefined;
  return {
    codigo: (d.codigoDocumento || '').trim(),
    numeroProcesso: numero,
    classe,
    title: `${classe ? `${classe} ` : ''}${numero} - TRF5`,
    ementa: extrairEmenta(d.texto || ''),
    fullText: limpar(d.texto || ''),
    relator: (d.relatorAcordao || d.relator || '').trim() || undefined,
    orgaoJulgador: d.orgaoJulgador?.trim() || undefined,
    dataJulgamento: data && !Number.isNaN(data.getTime()) ? data : undefined,
  };
}

/** Entra no acervo quando a ementa trata do tema (inclusive crimes licitatórios). */
export function noRecorteTrf5(d: DecisaoTrf5): boolean {
  return RE_TEMA.test(d.ementa);
}

function dataBr(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

export function montarUrlTrf5(o: { termo: string; inicio: Date; deslocamento: number }): string {
  const u = new URL(API_URL);
  u.searchParams.set('draw', '1');
  u.searchParams.set('start', String(o.deslocamento));
  u.searchParams.set('length', String(POR_PAGINA));
  u.searchParams.set('pesquisaLivre', o.termo);
  u.searchParams.set('dataIni', dataBr(o.inicio));
  for (const k of ['dataFim', 'numeroProcesso', 'orgaoJulgador', 'relator']) u.searchParams.set(k, '');
  return u.toString();
}

async function buscar(termo: string, inicio: Date): Promise<Trf5Doc[]> {
  const todos: Trf5Doc[] = [];
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const r = await fetch(montarUrlTrf5({ termo, inicio, deslocamento: p * POR_PAGINA }), {
      headers: { 'User-Agent': 'Mozilla/5.0 (sitedobarral jurisprudencia)' },
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`Júlia/TRF5 HTTP ${r.status}`);
    const j = (await r.json()) as { recordsFiltered?: number; data?: Trf5Doc[] };
    const lote = j.data || [];
    todos.push(...lote);
    if (lote.length < POR_PAGINA || todos.length >= (j.recordsFiltered ?? 0)) break;
  }
  return todos;
}

export interface OpcoesTrf5 extends TribunalScrapeOptions {
  /** Início da janela de julgamento (carga inicial). Padrão: 45 dias atrás. */
  desde?: Date;
  tempoMaxMs?: number;
}

class TRF5Scraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TRF5';
  fullName = 'Tribunal Regional Federal da 5ª Região';
  type = 'judicial' as const;
  hasApi = true;
  supportsFullText = true;
  agendaPropria = true;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const r = await fetch(montarUrlTrf5({ termo: 'licitação', inicio: new Date(Date.now() - 30 * 864e5), deslocamento: 0 }));
      return { scraperCode: SCRAPER_CODE, isHealthy: r.ok, consecutiveFailures: r.ok ? 0 : 1, message: `HTTP ${r.status}` };
    } catch (error) {
      return { scraperCode: SCRAPER_CODE, isHealthy: false, consecutiveFailures: 1, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async scrape(options: OpcoesTrf5 = {}): Promise<TribunalScrapeResult> {
    const inicio = Date.now();
    const { maxItems = 100, forceRescrape = false, tempoMaxMs = TEMPO_PROCESSAMENTO_MS } = options;
    const desde = options.desde ?? new Date(Date.now() - DIAS_JANELA * 864e5);
    const result: TribunalScrapeResult = { scraperCode: SCRAPER_CODE, itemsFound: 0, itemsNew: 0, itemsSkipped: 0, itemsError: 0, errors: [], duration: 0 };

    try {
      const porCodigo = new Map<string, DecisaoTrf5>();
      let brutos = 0;
      for (const termo of TERMOS) {
        const docs = await buscar(termo, desde);
        brutos += docs.length;
        for (const doc of docs) {
          const d = docParaDecisao(doc);
          if (d.codigo && noRecorteTrf5(d)) porCodigo.set(d.codigo, d);
        }
      }
      const decisoes = [...porCodigo.values()];
      result.itemsFound = decisoes.length;

      const id = (d: DecisaoTrf5) => buildFullIdentifier(SCRAPER_CODE, 'acordao', d.codigo.split(':').pop() || d.codigo);
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
          result.errors.push(`${d.numeroProcesso}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      result.duration = Date.now() - inicio;
      await logScraperHealth(SCRAPER_CODE, result.errors.length > 0 ? 'partial_failure' : 'success', {
        itemsFound: result.itemsFound,
        itemsNew: result.itemsNew,
        itemsError: result.itemsError,
        duration: result.duration,
        errorMessage: result.errors.length > 0 ? result.errors.slice(0, 10).join('; ') : undefined,
        metadata: { brutos, noRecorte: decisoes.length, jaGravados: existentes.size, processados, desde: desde.toISOString().slice(0, 10) },
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

  private async gravar(d: DecisaoTrf5, fullIdentifier: string, existe: boolean, result: TribunalScrapeResult): Promise<void> {
    const classification = await classifyDecision({ title: d.title, ementa: d.ementa, decisionType: 'acordao', tribunalCode: 'TRF5' });
    const summary =
      classification.approvalStatus === 'auto_approved'
        ? await generateDecisionSummary({ title: d.title, ementa: d.ementa, tribunalCode: 'TRF5' })
        : null;
    const numero = fullIdentifier.split(' ').pop() || d.codigo;
    const data = {
      tribunalCode: normalizeTribunalCode('TRF5'),
      tribunalName: this.fullName,
      decisionType: 'acordao',
      decisionNumber: numero,
      processNumber: d.numeroProcesso || null,
      year: d.dataJulgamento?.getUTCFullYear() ?? new Date().getFullYear(),
      fullIdentifier,
      title: d.title,
      ementa: d.ementa,
      fullText: d.fullText || null,
      summary,
      relator: d.relator || null,
      orgaoJulgador: d.orgaoJulgador || null,
      dataJulgamento: d.dataJulgamento || null,
      url: LINK_PESQUISA,
      isRelevant: classification.approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      ...setLeiArticles(classification.leiArticles),
      suggestedCourses: classification.suggestedCourses,
      sourceApi: 'trf5-julia',
      approvalStatus: classification.approvalStatus,
      confidence: classification.confidence,
      classificationReasoning: classification.reasoning,
    };
    if (existe) {
      await prisma.tribunalDecision.update({ where: { fullIdentifier }, data });
    } else {
      await prisma.tribunalDecision.create({ data });
      result.itemsNew++;
    }
  }
}

const trf5Scraper = new TRF5Scraper();

export { trf5Scraper };
export default trf5Scraper;
