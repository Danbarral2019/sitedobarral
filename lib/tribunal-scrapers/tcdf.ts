/**
 * TCDF Scraper — API de busca pública de jurisprudência
 *
 * Tribunal de Contas do Distrito Federal
 * API: https://api-busca-publica.tc.df.gov.br/jurisprudencia/ (Elasticsearch, JSON)
 *
 * O próprio TCDF faz a curadoria: cada decisão tem `jurisprudencia_situacao`
 * ("Publicada" ou "Descartada") e `jurisprudencia_classificacao_tematica`. Os
 * dois filtros são aplicados no servidor, então o universo coletado é a
 * jurisprudência publicada do tema "Licitações e Contratos": 902 decisões em
 * 26/09/2026, 183 delas de 2026. Com esses filtros o termo `q` quase não muda
 * o resultado (a API exige um termo não vazio).
 *
 * A API não ordena por data. Na execução periódica baixa-se o ano corrente e
 * o anterior (poucas centenas) e grava-se só o que falta, do mais recente
 * para o mais antigo.
 *
 * TLS: o servidor não envia o certificado intermediário. Ver
 * ./certs/lets-encrypt-ye.ts.
 */

import https from 'node:https';
import tls from 'node:tls';
import { prisma } from '@/lib/prisma';
import type { TribunalScraper, TribunalScrapeOptions, TribunalScrapeResult, ScraperHealthStatus } from './index';
import { buildFullIdentifier, normalizeDecisionNumber, normalizeTribunalCode, extractYear, logScraperHealth } from './utils';
import { classifyDecision, generateDecisionSummary, consumirOrcamentoIA, julgarAmbiguoComIA, type JulgamentoIA } from './classifier';
import { setLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from '@/lib/logger';
import { LETS_ENCRYPT_YE1, ISRG_ROOT_YE_CRUZADA_X2 } from './certs/lets-encrypt-ye';

const SCRAPER_CODE = 'tcdf';
const API_URL = 'https://api-busca-publica.tc.df.gov.br/jurisprudencia/';
const LINK_DECISAO = 'https://www.tc.df.gov.br/app/mesaVirtual/implementacao/?a=consultaETCDF&f=formPrincipal&edoc=';
export const TCDF_TEMA_LICITACOES = 'Licitações e Contratos';
const POR_PAGINA = 100;
const MAX_PAGINAS = 30;
const TIMEOUT_MS = 30_000;
/** Orçamento de processamento padrão numa execução do cron (ver tce-pr.ts). */
const TEMPO_PROCESSAMENTO_MS = 60_000;

const CA = [...tls.rootCertificates, LETS_ENCRYPT_YE1, ISRG_ROOT_YE_CRUZADA_X2];

/** Campos usados da resposta (`hits.hits[]._source`). */
export interface TcdfHit {
  documento_numero_ano?: string;
  documento_edoc?: string;
  jurisprudencia_tipo_descricao?: string;
  processo_numero_completo?: string;
  processo_relator?: string;
  sessao_data?: string;
  jurisprudencia_ementa?: string;
  jurisprudencia_verbetacao?: string;
  jurisprudencia_decisao?: string;
  jurisprudencia_situacao?: string;
  jurisprudencia_relevancia?: string;
  jurisprudencia_classificacao_tematica?: string;
}

export interface DecisaoTcdf {
  decisionNumber: string;
  title: string;
  ementa: string;
  fullText?: string;
  relator?: string;
  dataJulgamento?: Date;
  url?: string;
  processNumber?: string;
  relevanciaTcdf?: string;
}

export function montarUrlBusca(o: { ano?: number; deslocamento: number }): string {
  const u = new URL(API_URL);
  u.searchParams.set('q', 'licitacao');
  u.searchParams.set('from', String(o.deslocamento));
  u.searchParams.set('maxPerPage', String(POR_PAGINA));
  u.searchParams.set('filter[jurisprudencia_situacao]', 'Publicada');
  u.searchParams.set('filter[jurisprudencia_classificacao_tematica]', TCDF_TEMA_LICITACOES);
  if (o.ano) u.searchParams.set('filter[ano]', String(o.ano));
  return u.toString();
}

/** "1. A: B. C.; 2. D.;" → "A: B. C.\nD." */
function limparVerbetacao(v?: string): string {
  return (v || '')
    .split(/;\s*(?=\d+\.\s)|;\s*$/)
    .map((t) => t.replace(/^\s*\d+\.\s*/, '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * No TCDF, `jurisprudencia_ementa` descreve o objeto do processo ("Edital do
 * Pregão X, objeto Y"); o conteúdo jurídico está na verbetação e no
 * dispositivo. Por isso a verbetação vai à frente, e o dispositivo vira o
 * texto integral.
 */
export function hitParaDecisao(h: TcdfHit): DecisaoTcdf {
  const numero = (h.documento_numero_ano || '').trim();
  const tipo = (h.jurisprudencia_tipo_descricao || 'Decisão').trim();
  const verbetacao = limparVerbetacao(h.jurisprudencia_verbetacao);
  const ementa = [verbetacao, (h.jurisprudencia_ementa || '').trim()].filter(Boolean).join('\n\n');
  const data = h.sessao_data ? new Date(h.sessao_data) : undefined;
  return {
    decisionNumber: numero,
    title: `${tipo} ${numero} TCDF`,
    ementa,
    fullText: (h.jurisprudencia_decisao || '').trim() || undefined,
    relator: h.processo_relator?.trim() || undefined,
    dataJulgamento: data && !Number.isNaN(data.getTime()) ? data : undefined,
    url: h.documento_edoc ? `${LINK_DECISAO}${h.documento_edoc}` : undefined,
    processNumber: h.processo_numero_completo?.trim() || undefined,
    relevanciaTcdf: h.jurisprudencia_relevancia,
  };
}

function getJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca: CA, headers: { 'User-Agent': 'Mozilla/5.0 (sitedobarral jurisprudencia)' }, timeout: TIMEOUT_MS }, (res) => {
      let corpo = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (corpo += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} em ${url}`));
        try {
          resolve(JSON.parse(corpo));
        } catch {
          reject(new Error(`resposta não-JSON em ${url}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`timeout em ${url}`)));
    req.on('error', reject);
  });
}

async function buscarPagina(ano: number | undefined, deslocamento: number): Promise<{ total: number; hits: TcdfHit[] }> {
  const j = (await getJson(montarUrlBusca({ ano, deslocamento }))) as {
    data?: { hits?: { total?: { value?: number }; hits?: Array<{ _source: TcdfHit }> } };
  };
  const hits = j.data?.hits;
  if (!hits) throw new Error('resposta sem data.hits');
  return { total: hits.total?.value ?? 0, hits: (hits.hits || []).map((h) => h._source) };
}

type Status = 'auto_approved' | 'pending' | 'auto_rejected';

/**
 * Status final de uma decisão do TCDF. A fonte já vem filtrada pelo próprio
 * tribunal (publicada, tema "Licitações e Contratos"), e isso vale mais que o
 * scoring por palavra-chave, que rejeitaria 155 das 902 (26/09/2026):
 * - relevância Média, Alta ou Altíssima no TCDF → aprovada;
 * - relevância Baixa → segue o classificador (que já usa a IA nos pendentes);
 *   se a palavra-chave rejeitar, a decisão vai para a IA em vez de sair
 *   rejeitada. Sem IA disponível, fica pendente.
 *
 * `julgar` é null quando não há orçamento de IA.
 */
export async function statusTcdf(
  relevancia: string | undefined,
  classificacao: { approvalStatus: Status; reasoning: string },
  julgar: (() => Promise<JulgamentoIA | null>) | null,
): Promise<{ status: Status; motivoIA?: string }> {
  if (/^(m[ée]dia|alta|alt[íi]ssima)$/i.test((relevancia || '').trim())) return { status: 'auto_approved' };
  if (classificacao.approvalStatus !== 'auto_rejected') return { status: classificacao.approvalStatus };
  if (classificacao.reasoning.includes('IA:')) return { status: 'auto_rejected' }; // a IA já julgou
  const ia = julgar ? await julgar() : null;
  if (ia?.veredito === 'aprovar') return { status: 'auto_approved', motivoIA: ia.motivo };
  if (ia?.veredito === 'rejeitar') return { status: 'auto_rejected', motivoIA: ia.motivo };
  return { status: 'pending', motivoIA: ia?.motivo };
}

/** Baixa todas as páginas de um ano (ou do acervo inteiro, sem ano). */
export async function buscarDecisoesTcdf(ano?: number): Promise<TcdfHit[]> {
  const todos: TcdfHit[] = [];
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const { total, hits } = await buscarPagina(ano, p * POR_PAGINA);
    todos.push(...hits);
    if (hits.length < POR_PAGINA || todos.length >= total) break;
  }
  return todos;
}

export interface OpcoesTcdf extends TribunalScrapeOptions {
  /** Acervo inteiro em vez de ano corrente + anterior (carga inicial). */
  acervoCompleto?: boolean;
  /** Orçamento de processamento; padrão 60 s. `Infinity` na carga inicial. */
  tempoMaxMs?: number;
}

class TCDFScraper implements TribunalScraper {
  code = SCRAPER_CODE;
  name = 'TCDF';
  fullName = 'Tribunal de Contas do Distrito Federal';
  type = 'tce' as const;
  hasApi = true;
  supportsFullText = true;
  // O cron semanal dos TCEs já chega perto dos 300 s; o TCDF roda à parte.
  agendaPropria = true;

  canHandle(tribunalCode: string): boolean {
    return tribunalCode.toLowerCase() === SCRAPER_CODE;
  }

  async healthCheck(): Promise<ScraperHealthStatus> {
    try {
      const { total } = await buscarPagina(new Date().getFullYear(), 0);
      return { scraperCode: SCRAPER_CODE, isHealthy: true, consecutiveFailures: 0, message: `${total} decisões no ano` };
    } catch (error) {
      return {
        scraperCode: SCRAPER_CODE,
        isHealthy: false,
        consecutiveFailures: 1,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async scrape(options: OpcoesTcdf = {}): Promise<TribunalScrapeResult> {
    const inicio = Date.now();
    const { maxItems = 100, forceRescrape = false, acervoCompleto = false, tempoMaxMs = TEMPO_PROCESSAMENTO_MS } = options;
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
      const anoAtual = new Date().getFullYear();
      const hits = acervoCompleto
        ? await buscarDecisoesTcdf()
        : [...(await buscarDecisoesTcdf(anoAtual)), ...(await buscarDecisoesTcdf(anoAtual - 1))];
      if (hits.length === 0) throw new Error('API do TCDF não devolveu nenhuma decisão');

      const porNumero = new Map<string, DecisaoTcdf>();
      for (const h of hits) {
        const d = hitParaDecisao(h);
        if (d.decisionNumber) porNumero.set(normalizeDecisionNumber(d.decisionNumber), d);
      }
      const decisoes = [...porNumero.values()];
      result.itemsFound = decisoes.length;

      const id = (d: DecisaoTcdf) => buildFullIdentifier(SCRAPER_CODE, 'decisao', normalizeDecisionNumber(d.decisionNumber));
      const jaGravados = await prisma.tribunalDecision.findMany({
        where: { fullIdentifier: { in: decisoes.map(id) } },
        select: { fullIdentifier: true },
      });
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
          result.errors.push(`${d.decisionNumber}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      result.duration = Date.now() - inicio;
      await logScraperHealth(SCRAPER_CODE, result.errors.length > 0 ? 'partial_failure' : 'success', {
        itemsFound: result.itemsFound,
        itemsNew: result.itemsNew,
        itemsError: result.itemsError,
        duration: result.duration,
        errorMessage: result.errors.length > 0 ? result.errors.slice(0, 10).join('; ') : undefined,
        metadata: { hits: hits.length, jaGravados: existentes.size, selecionados: aProcessar.length, processados, acervoCompleto },
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

  private async gravar(d: DecisaoTcdf, fullIdentifier: string, existe: boolean, result: TribunalScrapeResult): Promise<void> {
    const classification = await classifyDecision({
      title: d.title,
      ementa: d.ementa,
      fullText: d.fullText,
      decisionType: 'decisao',
      tribunalCode: 'TCDF',
    });
    const entradaIA = { title: d.title, ementa: d.ementa, fullText: d.fullText, decisionType: 'decisao', tribunalCode: 'TCDF' };
    const { status: approvalStatus, motivoIA } = await statusTcdf(d.relevanciaTcdf, classification, () =>
      consumirOrcamentoIA() ? julgarAmbiguoComIA(entradaIA) : Promise.resolve(null),
    );
    const summary =
      approvalStatus === 'auto_approved'
        ? await generateDecisionSummary({ title: d.title, ementa: d.ementa })
        : null;
    const numero = normalizeDecisionNumber(d.decisionNumber);

    const data = {
      tribunalCode: normalizeTribunalCode('TCDF'),
      tribunalName: this.fullName,
      decisionType: 'decisao',
      decisionNumber: numero,
      processNumber: d.processNumber || null,
      year: extractYear(numero),
      fullIdentifier,
      title: d.title,
      ementa: d.ementa,
      fullText: d.fullText || null,
      summary,
      relator: d.relator || null,
      orgaoJulgador: 'Plenário',
      dataJulgamento: d.dataJulgamento || null,
      url: d.url || null,
      isRelevant: approvalStatus !== 'auto_rejected',
      relevanceScore: classification.relevanceScore,
      themes: JSON.stringify(classification.themes),
      ...setLeiArticles(classification.leiArticles),
      suggestedCourses: classification.suggestedCourses,
      sourceApi: 'tcdf-busca-publica',
      approvalStatus,
      confidence: classification.confidence,
      classificationReasoning: [
        classification.reasoning,
        motivoIA ? `IA (rejeição por palavra-chave revista): ${motivoIA}` : null,
        d.relevanciaTcdf ? `TCDF: publicada, relevância ${d.relevanciaTcdf}` : 'TCDF: publicada',
      ]
        .filter(Boolean)
        .join('; '),
    };

    if (existe) {
      await prisma.tribunalDecision.update({ where: { fullIdentifier }, data });
    } else {
      await prisma.tribunalDecision.create({ data });
      result.itemsNew++;
    }
  }
}

const tcdfScraper = new TCDFScraper();

export { tcdfScraper };
export default tcdfScraper;
