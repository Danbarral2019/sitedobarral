/**
 * Scraper para Informativos de Jurisprudência Selecionada do TCU
 *
 * Os informativos do TCU estão disponíveis via a pesquisa textual em:
 * https://pesquisa.apps.tcu.gov.br/pesquisa/jurisprudencia-selecionada
 *
 * A API subjacente usa um BFF (Backend For Frontend) com proteção WAF.
 * Este scraper usa a API REST do BFF encontrada no JS bundle da aplicação:
 *   POST /pesquisa/rest/relevar-busca-bff/api/v1
 *
 * Alternativa: scraping direto do portal de jurisprudência do TCU:
 *   https://portal.tcu.gov.br/jurisprudencia/
 *
 * NOTA: O site do TCU tem proteção anti-bot. Se a API falhar,
 * o scraper retorna um erro descritivo e o cron job registra o problema.
 *
 * Os informativos já existentes no banco foram importados de planilhas Excel
 * (1.973 enunciados) com category='informativo'.
 */

import { prisma } from '@/lib/prisma';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface InformativoItem {
  titulo: string;           // Ex: "Informativo de Licitações e Contratos nº 500/2024"
  enunciado: string;        // Tese/enunciado do informativo
  numero?: string;          // Número do informativo (ex: "500/2024")
  linkPdf?: string;         // Link para download do PDF
  dataPublicacao?: string;  // Data de publicação (DD/MM/YYYY ou ISO)
  url?: string;             // URL da página do informativo
}

export interface ScrapeResult {
  success: boolean;
  items: InformativoItem[];
  error?: string;
  source: 'tcu-bff-api' | 'tcu-portal-rss' | 'mock';
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

async function deduplicateAgainstDB(items: InformativoItem[]): Promise<NewInformativo[]> {
  // Buscar títulos existentes de informativos no banco
  const existingDocs = await prisma.document.findMany({
    where: { category: 'informativo' },
    select: { title: true },
  });

  // Criar set de títulos normalizados para comparação
  const existingTitles = new Set(
    existingDocs.map(d => normalizeTitle(d.title))
  );

  return items.map(item => {
    const titulo = item.titulo || `Informativo TCU - ${item.enunciado.slice(0, 80)}`;
    const normalized = normalizeTitle(titulo);

    // Verificar duplicata por título normalizado
    const isDuplicate = existingTitles.has(normalized);

    // Verificar também por enunciado (mais flexível)
    const enunciadoNorm = normalizeTitle(item.enunciado);
    const isDuplicateByEnunciado = !isDuplicate && Array.from(existingTitles).some(
      t => t.includes(enunciadoNorm.slice(0, 50)) || enunciadoNorm.includes(t.slice(0, 50))
    );

    return {
      titulo,
      enunciado: item.enunciado,
      numero: item.numero,
      linkPdf: item.linkPdf,
      dataPublicacao: parseDateBR(item.dataPublicacao),
      url: item.url,
      isDuplicate: isDuplicate || isDuplicateByEnunciado,
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

  // Estratégia 1: API BFF
  console.log('[Sync TCU Info] Tentando API BFF...');
  let result = await fetchFromBFF(limit);

  // Estratégia 2: Portal
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
