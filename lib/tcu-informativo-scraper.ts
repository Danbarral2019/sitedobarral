/**
 * Scraper para Informativos de Jurisprudência Selecionada do TCU
 *
 * ✅ STATUS 2026-07-09 (BIA-5): REFATORADO para a FONTE DE DADOS ABERTOS do TCU.
 *
 * Histórico: o TCU migrou o portal e a API BFF para SPAs (Angular/Next), então
 * ambas passaram a devolver HTML em vez de dados. O cron rodou 89+ dias
 * devolvendo zero (último import 2026-02-16) e foi pausado.
 *
 * Solução: o TCU publica um CSV de DADOS ABERTOS, estável e completo, com todos
 * os itens do "Informativo de Licitações e Contratos" (KEY|TITULO|COLEGIADO|
 * TEXTOACORDAO|ENUNCIADO|NUMERO|TEXTOINFO, um registro por linha). É a fonte
 * primária agora (`fetchFromDadosAbertosCSV`); BFF/Portal ficam como fallback
 * histórico. Dedup por NÚMERO do informativo (robusto contra diferença de
 * formato de título — os 1.970 itens antigos vieram de planilhas Excel).
 *
 * Fonte: sites.tcu.gov.br/dados-abertos/jurisprudencia/arquivos/boletim-informativo-lc/
 */

import { prisma } from '@/lib/prisma';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface InformativoItem {
  titulo: string;           // Ex: "Inf. 520/2026 — <resumo da tese>"
  enunciado: string;        // Tese/enunciado do informativo
  numero?: string;          // Número do informativo (ex: "520/2026")
  linkPdf?: string;         // Link para download do PDF
  dataPublicacao?: string;  // Data de publicação (DD/MM/YYYY ou ISO)
  url?: string;             // URL da página do informativo
  sourceKey?: string;       // KEY estável do CSV de dados abertos (dedup futuro)
}

export interface ScrapeResult {
  success: boolean;
  items: InformativoItem[];
  error?: string;
  source: 'tcu-dados-abertos-csv' | 'tcu-bff-api' | 'tcu-portal-rss' | 'mock';
}

export interface ScrapeOptions {
  dryRun?: boolean;
  limit?: number;
}

export interface NewInformativo {
  titulo: string;
  enunciado: string;
  numero?: string;
  linkPdf?: string;
  dataPublicacao?: Date | null;
  url?: string;
  isDuplicate: boolean;
}

// ─── URLs e constantes ───────────────────────────────────────────────────────

// Fonte PRIMÁRIA (BIA-5): CSV de dados abertos do TCU — estável e completo.
const TCU_DADOS_ABERTOS_CSV_URL =
  'https://sites.tcu.gov.br/dados-abertos/jurisprudencia/arquivos/boletim-informativo-lc/boletim-informativo-lc.csv';

// Página oficial do informativo — usada como `url` de origem dos itens (o CSV
// não traz URL por item; esta página lista/apresenta a série e valida 200).
const TCU_INFORMATIVO_PORTAL_URL =
  'https://portal.tcu.gov.br/jurisprudencia/boletins-e-informativos/informativo-de-licitacoes-e-contratos.htm';

// Fallbacks históricos (SPAs — atualmente sem dados; ver cabeçalho).
const TCU_BFF_API_URL = 'https://pesquisa.apps.tcu.gov.br/pesquisa/rest/relevar-busca-bff/api/v1';

const TCU_PORTAL_JURISPRUDENCIA_URL = 'https://portal.tcu.gov.br/jurisprudencia/';

const USER_AGENT = 'Mozilla/5.0 (compatible; SiteDoBarral/1.0; +https://sitedobarral.com.br)';

const FETCH_TIMEOUT_MS = 30_000;

// ─── Utilitários ─────────────────────────────────────────────────────────────

function parseDateBR(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;

  // Formato DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [dia, mes, ano] = parts;
    const date = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
    return isNaN(date.getTime()) ? null : date;
  }

  // Formato ISO
  const iso = new Date(dateStr);
  return isNaN(iso.getTime()) ? null : iso;
}

function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/[—–-]+/g, '-')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extrai número do informativo do título.
 * Ex: "Informativo de Licitações e Contratos nº 500/2024" => "500/2024"
 */
function extractNumero(titulo: string): string | undefined {
  const match = titulo.match(/n[ºo°]\s*(\d+(?:\/\d{4})?)/i);
  if (match) return match[1];

  // Tenta extrair padrão "Informativo XXX/YYYY"
  const match2 = titulo.match(/informativo\s+(?:de\s+)?.*?(\d+\/\d{4})/i);
  if (match2) return match2[1];

  return undefined;
}

// ─── Estratégia PRIMÁRIA: CSV de dados abertos do TCU ───────────────────────

/**
 * Parseia UMA linha de CSV pipe-delimitado com campos entre aspas e escape `""`.
 * O CSV do TCU tem um registro por linha (sem quebras dentro de campos).
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // aspa escapada ""
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === '|') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/**
 * Gera um título curto a partir do enunciado (a tese completa), no formato dos
 * itens existentes ("Inf. NNN/YYYY — <resumo>"). Corta na 1ª frase ou ~110 chars
 * em fronteira de palavra.
 */
export function buildInformativoShortTitle(numero: string, enunciado: string): string {
  const clean = enunciado.replace(/\s+/g, ' ').trim();
  let short = clean;
  const firstSentence = clean.match(/^(.{15,130}?[.;!])(?:\s|$)/);
  if (firstSentence) {
    short = firstSentence[1];
  } else if (clean.length > 120) {
    short = clean.slice(0, 120).replace(/\s+\S*$/, '') + '…';
  }
  return `Inf. ${numero} — ${short}`;
}

/** Chave de ordenação decrescente por recência (ano*1000 + número). */
function informativoOrder(numero?: string): number {
  if (!numero) return 0;
  const m = numero.match(/(\d+)\/(\d{4})/);
  if (!m) return 0;
  return parseInt(m[2]) * 1000 + parseInt(m[1]);
}

/**
 * Baixa e parseia o CSV de dados abertos do TCU. Colunas:
 * KEY | TITULO | COLEGIADO | TEXTOACORDAO | ENUNCIADO | NUMERO | TEXTOINFO
 * Retorna os itens ordenados por recência (mais novos primeiro), limitados a `limit`.
 */
async function fetchFromDadosAbertosCSV(limit: number): Promise<ScrapeResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(TCU_DADOS_ABERTOS_CSV_URL, {
      headers: { 'Accept': 'text/csv', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, items: [], error: `CSV dados abertos retornou ${response.status}`, source: 'tcu-dados-abertos-csv' };
    }

    const text = await response.text();
    const lines = text.split(/\r?\n/).filter(l => l.startsWith('"INFORMATIVO-LC'));
    if (lines.length === 0) {
      return { success: false, items: [], error: 'CSV sem registros de informativo (formato inesperado)', source: 'tcu-dados-abertos-csv' };
    }

    const items: InformativoItem[] = [];
    for (const line of lines) {
      const [key, titulo, colegiado, textoAcordao, enunciado] = parseCsvLine(line);
      const m = (titulo || '').match(/Contratos\s+(\d+)\/(\d{4})/i);
      const tese = (enunciado || '').trim();
      if (!m || !tese) continue;
      const numero = `${m[1]}/${m[2]}`;
      // Anexa a referência do acórdão (ex.: "Acórdão 28/2026 Plenário") ao conteúdo.
      const acordaoRef = (textoAcordao || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const enriched = acordaoRef ? `${tese}\n\n(${acordaoRef})` : tese;
      items.push({
        titulo: buildInformativoShortTitle(numero, tese),
        enunciado: enriched,
        numero,
        url: TCU_INFORMATIVO_PORTAL_URL,
        sourceKey: (key || '').replace(/^"|"$/g, '') || undefined,
      });
    }

    // Mais recentes primeiro; limita.
    items.sort((a, b) => informativoOrder(b.numero) - informativoOrder(a.numero));
    return { success: true, items: items.slice(0, limit), source: 'tcu-dados-abertos-csv' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, items: [], error: `Erro ao baixar/parsear CSV: ${msg}`, source: 'tcu-dados-abertos-csv' };
  }
}

// ─── Estratégia 1: API BFF do TCU ───────────────────────────────────────────

interface BFFResponse {
  dados?: Array<{
    titulo?: string;
    enunciado?: string;
    texto?: string;
    informativo?: string;
    informativo__texto?: string;
    dataSessao?: string;
    dataPublicacao?: string;
    urlArquivo?: string;
    urlArquivoPDF?: string;
    url?: string;
    key?: string;
  }>;
  totalDocumentos?: number;
}

async function fetchFromBFF(limit: number): Promise<ScrapeResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // Buscar enunciados de jurisprudência selecionada ordenados por data
    const params = new URLSearchParams({
      base: 'enunciados_jurisprudencia_selecionada',
      termo: '*',
      inicio: '0',
      quantidade: String(limit),
      ordenacao: 'DATA',
    });

    const response = await fetch(`${TCU_BFF_API_URL}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
        'Referer': 'https://pesquisa.apps.tcu.gov.br/pesquisa/jurisprudencia-selecionada',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        success: false,
        items: [],
        error: `API BFF retornou ${response.status}: ${response.statusText}`,
        source: 'tcu-bff-api',
      };
    }

    const data: BFFResponse = await response.json();

    if (!data.dados || !Array.isArray(data.dados)) {
      return {
        success: false,
        items: [],
        error: 'Resposta da API BFF sem campo "dados" ou não é array',
        source: 'tcu-bff-api',
      };
    }

    const items: InformativoItem[] = data.dados.map(item => ({
      titulo: item.titulo || item.informativo || '',
      enunciado: item.enunciado || item.texto || item.informativo__texto || '',
      numero: extractNumero(item.titulo || item.informativo || ''),
      linkPdf: item.urlArquivoPDF || item.urlArquivo || undefined,
      dataPublicacao: item.dataPublicacao || item.dataSessao || undefined,
      url: item.url || undefined,
    })).filter(item => item.titulo || item.enunciado);

    return {
      success: true,
      items,
      source: 'tcu-bff-api',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      items: [],
      error: `Erro ao acessar API BFF: ${msg}`,
      source: 'tcu-bff-api',
    };
  }
}

// ─── Estratégia 2: Portal de Jurisprudência (HTML) ──────────────────────────

async function fetchFromPortal(limit: number): Promise<ScrapeResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(TCU_PORTAL_JURISPRUDENCIA_URL, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        success: false,
        items: [],
        error: `Portal TCU retornou ${response.status}`,
        source: 'tcu-portal-rss',
      };
    }

    const html = await response.text();

    // O portal Next.js pode ter __NEXT_DATA__ com dados inline
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const items = extractFromNextData(nextData, limit);
        if (items.length > 0) {
          return { success: true, items, source: 'tcu-portal-rss' };
        }
      } catch {
        // __NEXT_DATA__ parsing failed, continue
      }
    }

    // Tentar extrair dados do HTML inline (script com dados JSON)
    const scriptMatches = html.match(/<script[^>]*>[\s\S]*?self\.__next_f\.push\(\[[\s\S]*?\]\)/g);
    if (scriptMatches) {
      const items = extractFromRSCPayload(scriptMatches, limit);
      if (items.length > 0) {
        return { success: true, items, source: 'tcu-portal-rss' };
      }
    }

    return {
      success: false,
      items: [],
      error: 'Não foi possível extrair informativos do portal (nenhum dado encontrado no HTML)',
      source: 'tcu-portal-rss',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      items: [],
      error: `Erro ao acessar portal: ${msg}`,
      source: 'tcu-portal-rss',
    };
  }
}

function extractFromNextData(data: Record<string, unknown>, limit: number): InformativoItem[] {
  const items: InformativoItem[] = [];

  function traverse(obj: unknown): void {
    if (items.length >= limit) return;
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) traverse(item);
      return;
    }

    const record = obj as Record<string, unknown>;

    // Procurar objetos que pareçam informativos (têm enunciado/tese + titulo)
    if (
      (typeof record.enunciado === 'string' || typeof record.tese === 'string') &&
      (typeof record.titulo === 'string' || typeof record.informativo === 'string')
    ) {
      items.push({
        titulo: (record.titulo as string) || (record.informativo as string) || '',
        enunciado: (record.enunciado as string) || (record.tese as string) || '',
        numero: extractNumero((record.titulo as string) || ''),
        linkPdf: (record.urlArquivoPDF as string) || (record.linkPdf as string) || undefined,
        dataPublicacao: (record.dataPublicacao as string) || (record.dataSessao as string) || undefined,
        url: (record.url as string) || undefined,
      });
      return;
    }

    for (const value of Object.values(record)) traverse(value);
  }

  traverse(data);
  return items;
}

function extractFromRSCPayload(scripts: string[], limit: number): InformativoItem[] {
  const items: InformativoItem[] = [];

  for (const script of scripts) {
    if (items.length >= limit) break;

    // Procurar JSON inline nos RSC payloads
    const jsonMatches = script.match(/\{[^{}]*"enunciado"[^{}]*\}/g);
    if (jsonMatches) {
      for (const jsonStr of jsonMatches) {
        if (items.length >= limit) break;
        try {
          const obj = JSON.parse(jsonStr);
          if (obj.enunciado || obj.tese) {
            items.push({
              titulo: obj.titulo || obj.informativo || '',
              enunciado: obj.enunciado || obj.tese || '',
              numero: extractNumero(obj.titulo || ''),
              linkPdf: obj.urlArquivoPDF || obj.linkPdf || undefined,
              dataPublicacao: obj.dataPublicacao || undefined,
              url: obj.url || undefined,
            });
          }
        } catch {
          // JSON parse failed, skip
        }
      }
    }
  }

  return items;
}

// ─── Deduplicação contra banco ───────────────────────────────────────────────

/** Extrai o número "NNN/YYYY" de um título de informativo (vários formatos). */
function extractNumeroFromTitle(title: string): string | undefined {
  const m = title.match(/Inf\.?\s*(\d+\/\d{4})/i) || title.match(/Contratos\s+(\d+\/\d{4})/i);
  return m ? m[1] : undefined;
}

async function deduplicateAgainstDB(items: InformativoItem[]): Promise<NewInformativo[]> {
  const existingDocs = await prisma.document.findMany({
    where: { category: 'informativo' },
    select: { title: true },
  });

  // Dedup por NÚMERO do informativo (robusto: os itens antigos vieram de Excel
  // com formato de título diferente, mas o número "NNN/YYYY" é estável). Cada
  // número traz múltiplas teses; se o número já existe no banco, toda a série
  // dele já foi importada — então tratamos como duplicado.
  const existingNumbers = new Set<string>();
  for (const d of existingDocs) {
    const n = extractNumeroFromTitle(d.title);
    if (n) existingNumbers.add(n);
  }
  // Fallback (itens sem número): comparação por título normalizado.
  const existingTitlesNorm = new Set(existingDocs.map(d => normalizeTitle(d.title)));

  return items.map(item => {
    const titulo = item.titulo || `Informativo TCU - ${item.enunciado.slice(0, 80)}`;
    const isDuplicate = item.numero
      ? existingNumbers.has(item.numero)
      : existingTitlesNorm.has(normalizeTitle(titulo));

    return {
      titulo,
      enunciado: item.enunciado,
      numero: item.numero,
      linkPdf: item.linkPdf,
      dataPublicacao: parseDateBR(item.dataPublicacao),
      url: item.url,
      isDuplicate,
    };
  });
}

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Faz scraping dos informativos mais recentes do TCU.
 *
 * Tenta múltiplas estratégias em ordem:
 * 1. API BFF do sistema de pesquisa do TCU
 * 2. Portal de Jurisprudência (HTML parsing)
 *
 * @param options.dryRun - Se true, não insere no banco
 * @param options.limit - Limite de informativos a buscar (padrão: 50)
 * @returns Array de informativos novos (não duplicados)
 */
export async function scrapeNewInformativos(options: ScrapeOptions = {}): Promise<{
  newItems: NewInformativo[];
  totalScraped: number;
  duplicates: number;
  source: string;
  error?: string;
}> {
  const { limit = 50 } = options;

  console.log(`[Sync TCU Info] Iniciando scraping de informativos (limit: ${limit})...`);

  // Estratégia PRIMÁRIA (BIA-5): CSV de dados abertos do TCU (estável e completo).
  console.log('[Sync TCU Info] Tentando CSV de dados abertos...');
  let result = await fetchFromDadosAbertosCSV(limit);

  // Fallback histórico 1: API BFF (SPA — atualmente sem dados).
  if (!result.success || result.items.length === 0) {
    console.log(`[Sync TCU Info] CSV falhou (${result.error}). Tentando API BFF...`);
    result = await fetchFromBFF(limit);
  }

  // Fallback histórico 2: Portal.
  if (!result.success || result.items.length === 0) {
    console.log(`[Sync TCU Info] API BFF falhou (${result.error}). Tentando portal...`);
    result = await fetchFromPortal(limit);
  }

  if (!result.success || result.items.length === 0) {
    const errorMsg = result.error || 'Nenhum informativo encontrado em nenhuma fonte';
    console.log(`[Sync TCU Info] Todas as estratégias falharam: ${errorMsg}`);
    return {
      newItems: [],
      totalScraped: 0,
      duplicates: 0,
      source: result.source,
      error: errorMsg,
    };
  }

  console.log(`[Sync TCU Info] ${result.items.length} informativos obtidos via ${result.source}`);

  // Deduplicar contra banco
  const deduped = await deduplicateAgainstDB(result.items);
  const newItems = deduped.filter(item => !item.isDuplicate);
  const duplicates = deduped.filter(item => item.isDuplicate).length;

  console.log(`[Sync TCU Info] ${newItems.length} novos, ${duplicates} duplicados`);

  return {
    newItems,
    totalScraped: result.items.length,
    duplicates,
    source: result.source,
  };
}
