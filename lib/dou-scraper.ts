/**
 * DOU Content Scraper (Cheerio version - serverless compatible)
 *
 * Enriquece dados da API oficial do DOU fazendo scraping
 * do conteudo completo das publicacoes.
 *
 * Usa cheerio + fetch (sem Playwright) para compatibilidade
 * com Vercel serverless functions.
 */

import * as cheerio from 'cheerio';
import { normalizeScrapedText } from './legislative-scrapers/normalize';

/**
 * Dados enriquecidos de uma publicacao DOU
 */
export interface DOUEnrichedContent {
  conteudo: string;
  edicao: string | null;
  secao: string | null;
  pagina: string | null;
  data: string | null;
  orgao: string;
  caracteres: number;
  paragrafos: number;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

/**
 * Fetch com retry e timeout
 */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (attempt < retries && response.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeout);
      if (attempt >= retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error('Todas as tentativas falharam');
}

/**
 * Extrai conteudo completo de uma URL DOU usando cheerio
 */
export async function scrapeContent(url: string): Promise<DOUEnrichedContent | null> {
  console.log(`[DOU Scraper] Extraindo: ${url.substring(0, 80)}...`);

  try {
    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    // A div 'texto-dou' contem o conteudo principal
    const textoDou = $('.texto-dou');
    if (textoDou.length === 0) {
      // Fallback: tentar '.materia' ou '#materia'
      const materia = $('.materia, #materia');
      if (materia.length === 0) {
        console.warn(`[DOU Scraper] Estrutura nao encontrada em: ${url}`);
        return null;
      }
    }

    // Extrair metadados da div 'detalhes-dou'
    const detalhesDou = $('.detalhes-dou');
    const paragrafosDetalhes = detalhesDou.find('p');
    const publicacao = paragrafosDetalhes.eq(0).text().trim();
    const orgaoRaw = paragrafosDetalhes.eq(1).text().trim();

    // Extrair paragrafos do texto principal
    const container = textoDou.length > 0 ? textoDou : $('.materia, #materia');
    const paragrafos: string[] = [];
    container.find('p').each((_: number, el: cheerio.Element) => {
      const text = $(el).text().trim();
      if (text && !text.includes('Este conteudo nao substitui') && !text.includes('Este conte\u00FAdo n\u00E3o substitui')) {
        paragrafos.push(text);
      }
    });

    // Aplica pipeline completo de normalização (collapseWhitespace +
    // stripDouBoilerplate + stripGovbrUiNoise + stripFormAnnex). Cada
    // helper é no-op em texto sem seus markers, então rodar todos é
    // seguro mesmo quando o conteúdo veio bem-formado do DOU.
    const conteudo = normalizeScrapedText(paragrafos.join('\n\n'));

    // Extrair edicao, secao e pagina dos metadados
    const edicaoMatch = publicacao.match(/Edi[çc][ãa]o:\s*(\d+(?:-[A-Z])?)/i);
    const secaoMatch = publicacao.match(/Se[çc][ãa]o:\s*([^|]+)/i);
    const paginaMatch = publicacao.match(/P[áa]gina:\s*(\d+)/i);
    const dataMatch = publicacao.match(/Publicado em:\s*(\d{2}\/\d{2}\/\d{4})/);

    // Limpar orgao (remover "Orgao: ")
    const orgao = orgaoRaw.replace(/^[Óó]rg[ãa]o:\s*/i, '').trim();

    const result: DOUEnrichedContent = {
      conteudo,
      edicao: edicaoMatch ? edicaoMatch[1] : null,
      secao: secaoMatch ? secaoMatch[1].trim() : null,
      pagina: paginaMatch ? paginaMatch[1] : null,
      data: dataMatch ? dataMatch[1] : null,
      orgao,
      caracteres: conteudo.length,
      paragrafos: paragrafos.length,
    };

    console.log(`[DOU Scraper] Extraido: ${result.caracteres} caracteres, ${result.paragrafos} paragrafos`);
    return result;
  } catch (error) {
    console.error(`[DOU Scraper] Erro ao extrair ${url}:`, error);
    return null;
  }
}

/**
 * Extrai conteudo de multiplas URLs com rate limiting
 */
export async function scrapeMultiple(
  urls: string[],
  delayMs: number = 1500
): Promise<Map<string, DOUEnrichedContent>> {
  const results = new Map<string, DOUEnrichedContent>();

  console.log(`[DOU Scraper] Processando ${urls.length} URLs...`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    console.log(`[DOU Scraper] [${i + 1}/${urls.length}] Processando...`);

    const content = await scrapeContent(url);

    if (content) {
      results.set(url, content);
    }

    // Rate limiting (exceto na ultima iteracao)
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[DOU Scraper] Concluido: ${results.size}/${urls.length} sucessos`);
  return results;
}

/**
 * Helper: scrape uma URL (sem gerenciamento de browser necessario)
 */
export async function scrapeURL(url: string): Promise<DOUEnrichedContent | null> {
  return scrapeContent(url);
}

/**
 * Helper: scrape multiplas URLs
 */
export async function scrapeURLs(
  urls: string[],
  delayMs: number = 1500
): Promise<Map<string, DOUEnrichedContent>> {
  return scrapeMultiple(urls, delayMs);
}
