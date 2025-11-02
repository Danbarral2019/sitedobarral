/**
 * DOU Content Scraper
 *
 * Enriquece dados da API oficial do DOU fazendo scraping
 * do conteúdo completo das publicações.
 *
 * Usa Playwright para navegar e extrair texto completo,
 * metadados adicionais e informações estruturadas.
 */

import { chromium, Browser, Page } from 'playwright';

/**
 * Dados enriquecidos de uma publicação DOU
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

/**
 * Cliente de scraping para páginas DOU
 */
export class DOUScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Inicializa o navegador
   */
  async init() {
    if (this.browser) return; // Já inicializado

    console.log('[DOU Scraper] 🚀 Inicializando navegador Playwright...');

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // Criar contexto com user agent
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await context.newPage();

    console.log('[DOU Scraper] ✅ Navegador iniciado');
  }

  /**
   * Fecha o navegador
   */
  async close() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[DOU Scraper] 🔒 Navegador fechado');
    }
  }

  /**
   * Extrai conteúdo completo de uma URL DOU
   */
  async scrapeContent(url: string): Promise<DOUEnrichedContent | null> {
    if (!this.page) {
      throw new Error('Navegador não inicializado. Chame init() primeiro.');
    }

    console.log(`[DOU Scraper] 📄 Extraindo: ${url.substring(0, 80)}...`);

    try {
      // Navegar até a página
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Aguardar conteúdo carregar
      await this.page.waitForSelector('.texto-dou', { timeout: 10000 });

      // Extrair dados usando script no navegador
      const dados = await this.page.evaluate(() => {
        // A div 'texto-dou' contém o conteúdo principal
        const textoDou = document.querySelector('.texto-dou');
        if (!textoDou) return null;

        // Pegar metadados da div 'detalhes-dou'
        const detalhesDou = document.querySelector('.detalhes-dou');
        const paragrafosDetalhes = detalhesDou
          ? Array.from(detalhesDou.querySelectorAll('p'))
          : [];

        const publicacao = paragrafosDetalhes[0]?.textContent?.trim() || '';
        const orgao = paragrafosDetalhes[1]?.textContent?.trim() || '';

        // Extrair todos os parágrafos do texto principal
        const paragrafosTexto = Array.from(textoDou.querySelectorAll('p'));
        const conteudo = paragrafosTexto
          .map((p) => p.textContent?.trim())
          .filter((t) => t && !t.includes('Este conteúdo não substitui'))
          .join('\n\n');

        // Extrair edição, seção e página dos metadados
        const edicaoMatch = publicacao.match(/Edição:\s*(\d+(?:-[A-Z])?)/);
        const secaoMatch = publicacao.match(/Seção:\s*([^\|]+)/);
        const paginaMatch = publicacao.match(/Página:\s*(\d+)/);
        const dataMatch = publicacao.match(/Publicado em:\s*(\d{2}\/\d{2}\/\d{4})/);

        // Limpar órgão (remover "Órgão: ")
        const orgaoLimpo = orgao.replace(/^Órgão:\s*/i, '').trim();

        return {
          conteudo,
          edicao: edicaoMatch ? edicaoMatch[1] : null,
          secao: secaoMatch ? secaoMatch[1].trim() : null,
          pagina: paginaMatch ? paginaMatch[1] : null,
          data: dataMatch ? dataMatch[1] : null,
          orgao: orgaoLimpo,
          caracteres: conteudo.length,
          paragrafos: paragrafosTexto.length,
        };
      });

      if (!dados) {
        console.warn(`[DOU Scraper] ⚠️  Estrutura não encontrada em: ${url}`);
        return null;
      }

      console.log(`[DOU Scraper] ✅ Extraído: ${dados.caracteres} caracteres, ${dados.paragrafos} parágrafos`);

      return dados;
    } catch (error) {
      console.error(`[DOU Scraper] ❌ Erro ao extrair ${url}:`, error);
      return null;
    }
  }

  /**
   * Extrai conteúdo de múltiplas URLs com rate limiting
   */
  async scrapeMultiple(
    urls: string[],
    delayMs: number = 2000
  ): Promise<Map<string, DOUEnrichedContent>> {
    const results = new Map<string, DOUEnrichedContent>();

    console.log(`[DOU Scraper] 🔄 Processando ${urls.length} URLs...`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      console.log(`[DOU Scraper] [${i + 1}/${urls.length}] Processando...`);

      const content = await this.scrapeContent(url);

      if (content) {
        results.set(url, content);
      }

      // Rate limiting (exceto na última iteração)
      if (i < urls.length - 1) {
        console.log(`[DOU Scraper] ⏳ Aguardando ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[DOU Scraper] ✅ Concluído: ${results.size}/${urls.length} sucessos`);

    return results;
  }
}

/**
 * Instância singleton (use com cuidado - lembre de chamar close())
 */
let scraperInstance: DOUScraper | null = null;

/**
 * Helper: obter instância singleton
 */
export function getScraperInstance(): DOUScraper {
  if (!scraperInstance) {
    scraperInstance = new DOUScraper();
  }
  return scraperInstance;
}

/**
 * Helper: scrape com gerenciamento automático do navegador
 */
export async function scrapeURL(url: string): Promise<DOUEnrichedContent | null> {
  const scraper = new DOUScraper();

  try {
    await scraper.init();
    return await scraper.scrapeContent(url);
  } finally {
    await scraper.close();
  }
}

/**
 * Helper: scrape múltiplas URLs com gerenciamento automático
 */
export async function scrapeURLs(
  urls: string[],
  delayMs: number = 2000
): Promise<Map<string, DOUEnrichedContent>> {
  const scraper = new DOUScraper();

  try {
    await scraper.init();
    return await scraper.scrapeMultiple(urls, delayMs);
  } finally {
    await scraper.close();
  }
}
