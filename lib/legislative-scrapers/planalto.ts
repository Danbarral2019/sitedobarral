/**
 * Scraper para www.planalto.gov.br
 *
 * Extrai textos de leis, decretos e outros atos normativos do portal do Planalto.
 * Suporta múltiplos formatos de URL e estruturas de página.
 */

import * as cheerio from 'cheerio';
import { computeHash } from './change-detector';
import type { LegislativeScraper, ScraperResult } from './index';
import { collapseWhitespace, detectCharsetFromResponse, blockAwareText } from './normalize';
import { removerTextoRiscado } from './texto-riscado';

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
  // head/title/meta/link: sem eles o texto do documento inteiro ($.root())
  // não carrega o <title> nem CSS como se fossem texto do ato.
  'head',
  'title',
  'meta',
  'link',
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

      // planalto.gov.br serve grande parte das páginas em ISO-8859-1.
      // response.text() do fetch() decodifica como UTF-8 — chars acentuados
      // viram U+FFFD ("Bras�lia"). Detectamos o charset (Content-Type +
      // <meta>) e decodificamos com TextDecoder explícito.
      const buffer = await response.arrayBuffer();

      // Verificar tamanho máximo (5MB).
      if (buffer.byteLength > 5 * 1024 * 1024) {
        return {
          success: false,
          error: 'Conteúdo muito grande (>5MB)',
        };
      }

      const charset = detectCharsetFromResponse(response.headers.get('content-type'), buffer);
      const html = new TextDecoder(charset, { fatal: false }).decode(buffer);

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
    const $ = this.loadClean(html);
    // Só caracteres visíveis: a indentação e as quebras do HTML do Planalto
    // pesavam mais que o texto e escondiam o ato riscado por inteiro
    // (Decreto 11.317/2022 caía de 2.225 para 208 caracteres).
    const visiveis = (root: cheerio.Root) => blockAwareText(root.root()).replace(/\s+/g, '').length;
    const fullText = visiveis($);

    // Redação superada, riscada no texto compilado, não é texto vigente
    // (ver texto-riscado.ts). Se o riscado for quase tudo, o ato inteiro foi
    // revogado e o Planalto risca o corpo; aí o texto histórico fica.
    removerTextoRiscado($);
    if (visiveis($) < fullText * 0.2) {
      return this.extractFrom(this.loadClean(html));
    }
    return this.extractFrom($);
  }

  private loadClean(html: string): cheerio.Root {
    const $ = cheerio.load(html);

    // Remover elementos indesejados
    ELEMENTS_TO_REMOVE.forEach(selector => {
      $(selector).remove();
    });
    return $;
  }

  private extractFrom($: cheerio.Root): string {

    // O cheerio 0.22 (htmlparser2) não reconstrói o HTML malformado do
    // Planalto: no Código Civil compilado o texto vem depois de um </body>
    // prematuro, e a página da Lei 10.973/2004 nem tem <body>. O texto de
    // $('body') perdia a lei inteira; o do documento todo, não.
    const docText = this.cleanText(blockAwareText($.root()));

    // Tentar cada seletor até encontrar conteúdo
    for (const selector of CONTENT_SELECTORS) {
      const element = $(selector);
      if (element.length > 0) {
        const text = this.cleanText(blockAwareText(element));
        // Bloco com menos da metade do documento é cabeçalho ou tabela lateral
        // ("Vigência", "Mensagem de veto"), não o texto do ato. Visto no
        // Código Civil compilado: o seletor de tabela devolvia 378 caracteres
        // e o texto da lei, solto no body, ficava de fora.
        if (text.length > 100 && text.length >= docText.length * 0.5) {
          return text;
        }
      }
    }

    // Fallback: o documento inteiro
    return docText;
  }

  /**
   * Limpa e normaliza o texto extraído.
   *
   * Trata pontilhados (`...........`) que o Planalto usa como convenção legal
   * pra indicar omissão de incisos/parágrafos não alterados pela norma — ex:
   *   "Art. 2º .................................. I - acordo de adesão"
   * Visualmente esses pontos longos ficam horríveis. Padrão internacional é
   * `[…]` ou `[...]`. Convertemos `\.{6,}` → `[...]` (6+ pontos consecutivos
   * com possíveis espaços; preservamos `...` e `....` literais que aparecem
   * em fim de frase).
   */
  private cleanText(text: string): string {
    const collapsed = collapseWhitespace(text);
    // Sequências de 6+ pontos (com espaços/quebras intercalados) → "[...]"
    // Casos cobertos: "Art. 2º ..................." → "Art. 2º [...]"
    //                 "Art. 2º .  .  .  .  .  ." → "Art. 2º [...]"
    return collapsed.replace(/(?:\s*\.\s*){6,}/g, ' [...] ');
  }
}
