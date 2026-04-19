/**
 * Scraper para www.gov.br/compras (MGI - Ministério da Gestão e Inovação)
 *
 * Extrai textos de instruções normativas, portarias e outros atos
 * relacionados a licitações e contratos públicos.
 */

import * as cheerio from 'cheerio';
import { computeHash } from './change-detector';
import { stripDouBoilerplate, stripFormAnnex } from './normalize';
import type { LegislativeScraper, ScraperResult } from './index';

/**
 * Patterns de URL do Gov.br Compras e MGI
 */
const GOVBR_PATTERNS = [
  /gov\.br\/compras/i,
  /gov\.br\/gestao/i,
  /gov\.br\/mgi/i,
  /gov\.br\/seges/i,
  /in\.gov\.br/i,
];

/**
 * Elementos a serem removidos
 */
const ELEMENTS_TO_REMOVE = [
  'script',
  'style',
  'nav',
  'header',
  'footer',
  '.portal-column',
  '.portlet',
  '.breadcrumb',
  '#viewlet-below-content-body',
  '.social-sharing',
  '.related-items',
  'iframe',
];

export class GovBrComprasScraper implements LegislativeScraper {
  name = 'govbr-compras';

  canHandle(url: string): boolean {
    return GOVBR_PATTERNS.some(pattern => pattern.test(url));
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

      // Detectar se é página DOU (in.gov.br). Em in.gov.br o wrapper do artigo
      // tem class="portlet", então saltamos a remoção de .portlet nessa origem
      // para não apagar o próprio corpo normativo.
      let isDou = false;
      try {
        isDou = /(?:^|\.)in\.gov\.br$/.test(new URL(url).hostname);
      } catch {
        isDou = false;
      }

      const rawContent = this.extractContent(html, { skipPortletRemoval: isDou });

      // Aplicar limpeza DOU se URL for in.gov.br
      const douCleaned = isDou ? stripDouBoilerplate(rawContent) : rawContent;
      const content = stripFormAnnex(douCleaned);

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
   *
   * @param opts.skipPortletRemoval - Se true, pula a remoção do seletor `.portlet`.
   *   Necessário para páginas in.gov.br, onde `<article id="materia">` fica
   *   dentro de um wrapper `.portlet` (remover o portlet apagaria o corpo
   *   normativo inteiro).
   */
  private extractContent(html: string, opts: { skipPortletRemoval?: boolean } = {}): string {
    const $ = cheerio.load(html);

    // Remover elementos indesejados
    const toRemove = opts.skipPortletRemoval
      ? ELEMENTS_TO_REMOVE.filter(s => s !== '.portlet')
      : ELEMENTS_TO_REMOVE;
    toRemove.forEach(selector => {
      $(selector).remove();
    });

    // Estratégia: coletar texto de TODOS os seletores primários,
    // escolher o de MAIOR tamanho desde que > 500 chars.
    // Primários = seletores que capturam o corpo completo do ato.
    const PRIMARY_SELECTORS = [
      '#parent-fieldname-text', // Plone body (gov.br/compras, gov.br/gestao) — geralmente o mais longo
      '.materia',                // DOU materia
      '#content-core',           // Plone content wrapper (pode conter body ou só metadados)
      'article',                 // HTML5 article
      'main',                    // HTML5 main
      '.content-area',
      '#main-content',
      '.conteudo-materia',
      '.texto-dou',
    ];

    let best = '';
    for (const selector of PRIMARY_SELECTORS) {
      const el = $(selector);
      if (el.length === 0) continue;
      const text = this.cleanText(el.text());
      if (text.length > best.length) {
        best = text;
      }
    }

    if (best.length >= 500) {
      return best;
    }

    // Fallbacks genéricos com threshold menor (para atos legitimamente curtos)
    const FALLBACK_SELECTORS = [
      '.text-body',
      '.dou-paragraph',
      '#materia',
      '.content',
      '.documentFirstHeading + div',
    ];

    for (const selector of FALLBACK_SELECTORS) {
      const el = $(selector);
      if (el.length === 0) continue;
      const text = this.cleanText(el.text());
      if (text.length > 100) return text;
    }

    // Último recurso: body inteiro
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
