/**
 * Scraper para www.planalto.gov.br
 *
 * Extrai textos de leis, decretos e outros atos normativos do portal do Planalto.
 * Suporta múltiplos formatos de URL e estruturas de página.
 */

import * as cheerio from 'cheerio';
import { computeHash } from './change-detector';
import type { LegislativeScraper, ScraperResult } from './index';

/**
 * Patterns de URL do Planalto
 */
const PLANALTO_PATTERNS = [
  /planalto\.gov\.br/i,
  /legislacao\.planalto\.gov\.br/i,
];

/**
 * Seletores CSS para extração de conteúdo do Planalto
 * Ordenados por preferência (primeiro match ganha)
 */
const CONTENT_SELECTORS = [
  // Páginas de legislação mais recentes
  '#conteudoTexto',
  '#texto',
  '.conteudoTexto',
  '.texto-lei',
  // Páginas antigas
  'body > table:nth-of-type(2) td',
  '.textoNorma',
  '#conteudo',
  // Fallback genérico
  'article',
  'main',
];

/**
 * Elementos a serem removidos do conteúdo
 */
const ELEMENTS_TO_REMOVE = [
  'script',
  'style',
  'nav',
  'header',
  'footer',
  '.menu',
  '.rodape',
  '.cabecalho',
  'iframe',
];

export class PlanaltoScraper implements LegislativeScraper {
  name = 'planalto';

  canHandle(url: string): boolean {
    return PLANALTO_PATTERNS.some(pattern => pattern.test(url));
  }

  async scrape(url: string): Promise<ScraperResult> {
    try {
      // Fetch com timeout de 30s
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const html = await response.text();

      // Verificar tamanho máximo (500KB)
      if (html.length > 500 * 1024) {
        return {
          success: false,
          error: 'Conteúdo muito grande (>500KB)',
        };
      }

      const content = this.extractContent(html);

      if (!content || content.length < 100) {
        return {
          success: false,
          error: 'Não foi possível extrair conteúdo significativo da página',
        };
      }

      const hash = computeHash(content);

      return {
        success: true,
        content,
        hash,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Timeout: página demorou mais de 30s para responder',
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao acessar página',
      };
    }
  }

  /**
   * Extrai o conteúdo textual limpo do HTML
   */
  private extractContent(html: string): string {
    const $ = cheerio.load(html);

    // Remover elementos indesejados
    ELEMENTS_TO_REMOVE.forEach(selector => {
      $(selector).remove();
    });

    // Tentar cada seletor até encontrar conteúdo
    for (const selector of CONTENT_SELECTORS) {
      const element = $(selector);
      if (element.length > 0) {
        const text = this.cleanText(element.text());
        if (text.length > 100) {
          return text;
        }
      }
    }

    // Fallback: pegar todo o body
    return this.cleanText($('body').text());
  }

  /**
   * Limpa e normaliza o texto extraído
   */
  private cleanText(text: string): string {
    return text
      // Normalizar quebras de linha
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remover múltiplas quebras de linha
      .replace(/\n{3,}/g, '\n\n')
      // Remover espaços múltiplos
      .replace(/[ \t]+/g, ' ')
      // Remover espaços no início/fim de linhas
      .replace(/^ +| +$/gm, '')
      // Remover linhas em branco no início/fim
      .trim();
  }
}
