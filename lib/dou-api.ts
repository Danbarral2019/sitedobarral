/**
 * Cliente para API Oficial do DOU (Diário Oficial da União)
 *
 * API: http://www.in.gov.br/consulta/-/buscar/dou
 * Baseado na implementação do Ro-DOU (https://github.com/gestaogovbr/Ro-dou)
 *
 * Esta API é oficial da Imprensa Nacional e retorna dados estruturados
 * do Diário Oficial da União federal.
 */

import * as cheerio from 'cheerio';

/**
 * Seções do DOU
 */
export enum DOUSection {
  SECAO_1 = 'do1',
  SECAO_2 = 'do2',
  SECAO_3 = 'do3',
  EDICAO_EXTRA = 'doe',
  TODOS = 'todos',
}

/**
 * Período de busca
 */
export enum DOUPeriod {
  DIA = 'dia',
  SEMANA = 'semana',
  MES = 'mes',
  ANO = 'ano',
  PERSONALIZADO = 'personalizado',
}

/**
 * Campos de busca
 */
export enum DOUField {
  TUDO = 'tudo',
  TITULO = 'title',
  CONTEUDO = 'content',
}

/**
 * Resultado da busca no DOU
 */
export interface DOUSearchResult {
  section: string;
  title: string;
  href: string;
  abstract: string;
  date: string; // DD/MM/YYYY
  id: string;
  hierarchyList: string[];
  hierarchyStr: string;
  artType: string;
  score?: number; // Score para paginação
  displayDate?: number; // Timestamp para paginação
}

/**
 * Parâmetros de busca
 */
export interface DOUSearchParams {
  searchTerm: string;
  sections?: DOUSection[];
  period?: DOUPeriod;
  publishFrom?: string; // DD-MM-YYYY (apenas se period=personalizado)
  publishTo?: string; // DD-MM-YYYY (apenas se period=personalizado)
  field?: DOUField;
  isExactSearch?: boolean;
  maxResults?: number; // Limite de resultados (padrão: sem limite)
}

/**
 * Cliente para busca na API oficial do DOU
 */
export class DOUClient {
  private baseUrl = 'https://www.in.gov.br/consulta/-/buscar/dou';
  private webBaseUrl = 'https://www.in.gov.br/web/dou/-/';
  private maxRetries = 3;
  private timeoutMs = 30000;

  /**
   * Fetch com retry e timeout
   */
  private async fetchWithRetry(url: string, retries = this.maxRetries): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          if (attempt < retries && response.status >= 500) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            console.warn(`[DOU API] Tentativa ${attempt}/${retries} falhou (HTTP ${response.status}), aguardando ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        clearTimeout(timeout);

        if (error instanceof DOMException && error.name === 'AbortError') {
          console.warn(`[DOU API] Timeout na tentativa ${attempt}/${retries}`);
        }

        if (attempt >= retries) throw error;

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`[DOU API] Tentativa ${attempt}/${retries} falhou, aguardando ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Todas as tentativas falharam');
  }

  /**
   * Constrói query string para busca
   */
  private getQueryString(term: string, field: DOUField, isExact: boolean): string {
    // Para termos com mais de uma palavra, adicionar aspas duplas
    const queryTerm = isExact ? `"${term}"` : term;

    if (field === DOUField.TUDO) {
      return queryTerm;
    } else {
      return `${field}-${queryTerm}`;
    }
  }

  /**
   * Busca publicações no DOU
   */
  async search(params: DOUSearchParams): Promise<DOUSearchResult[]> {
    const {
      searchTerm,
      sections = [DOUSection.TODOS],
      period = DOUPeriod.SEMANA,
      publishFrom,
      publishTo,
      field = DOUField.TUDO,
      isExactSearch = false,
      maxResults,
    } = params;

    const queryString = this.getQueryString(searchTerm, field, isExactSearch);

    // Montar payload base
    const urlParams = new URLSearchParams({
      q: queryString,
      exactDate: period,
      sortType: '0',
    });

    // Se for período personalizado, adicionar datas
    if (period === DOUPeriod.PERSONALIZADO && publishFrom && publishTo) {
      urlParams.set('publishFrom', publishFrom);
      urlParams.set('publishTo', publishTo);
    }

    // Adicionar seções
    urlParams.set('s', sections.join(','));

    const url = `${this.baseUrl}?${urlParams.toString()}`;

    console.log(`[DOU API] Buscando: ${searchTerm}`);
    console.log(`[DOU API] URL: ${url}`);

    try {
      // Fazer requisição com retry e timeout
      const response = await this.fetchWithRetry(url);
      const html = await response.text();

      // Parse HTML com cheerio (mais leve e compatível com serverless)
      const $ = cheerio.load(html);

      // Verificar paginação
      const lastPageBtn = $('button#lastPage');
      const secondPageBtn = $('button[id="2btn"]');

      let numberPages = 1;
      if (lastPageBtn.length > 0) {
        numberPages = parseInt(lastPageBtn.text().trim() || '1');
      } else if (secondPageBtn.length > 0) {
        numberPages = 2;
      }

      console.log(`[DOU API] Total de páginas: ${numberPages}`);

      const allResults: DOUSearchResult[] = [];
      let consecutiveEmptyPages = 0;
      const MAX_CONSECUTIVE_EMPTY = 3; // Parar após 3 páginas vazias consecutivas

      // Loop por cada página
      for (let pageNum = 0; pageNum < numberPages; pageNum++) {
        console.log(`[DOU API] Processando página ${pageNum + 1}`);

        let pageHtml = html;

        // Se não é a primeira página, fazer nova requisição com paginação
        if (pageNum > 0 && allResults.length > 0) {
          const lastItem = allResults[allResults.length - 1];

          const paginatedParams = new URLSearchParams(urlParams);
          paginatedParams.set('delta', '20'); // Items por página
          paginatedParams.set('currentPage', String(pageNum));
          paginatedParams.set('newPage', String(pageNum + 1));
          paginatedParams.set('score', String(lastItem.score || 0));
          paginatedParams.set('id', lastItem.id);
          paginatedParams.set('displayDate', String(lastItem.displayDate || dateToTimestamp(lastItem.date)));

          const paginatedUrl = `${this.baseUrl}?${paginatedParams.toString()}`;

          console.log(`[DOU API] 🔗 URL paginação: ${paginatedUrl.substring(0, 150)}...`);

          const pageResponse = await this.fetchWithRetry(paginatedUrl);

          pageHtml = await pageResponse.text();
        }

        // Extrair JSON embutido no script tag
        const $page = cheerio.load(pageHtml);
        const scriptTag = $page('script#_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params');

        if (scriptTag.length === 0 || !scriptTag.html()) {
          console.warn(`[DOU API] ⚠️  Nenhum script tag na página ${pageNum + 1}`);
          continue;
        }

        let jsonData, searchResults;
        try {
          jsonData = JSON.parse(scriptTag.html() || '{}');
          searchResults = jsonData.jsonArray;
        } catch (error) {
          console.error(`[DOU API] ❌ Erro ao parsear JSON da página ${pageNum + 1}:`, error);
          continue;
        }

        if (!searchResults || searchResults.length === 0) {
          console.warn(`[DOU API] ⚠️  Página ${pageNum + 1} retornou array vazio`);
          consecutiveEmptyPages++;

          if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY) {
            console.warn(`[DOU API] 🛑 Parando: ${MAX_CONSECUTIVE_EMPTY} páginas vazias consecutivas`);
            break;
          }
          continue;
        }

        // Reset contador se encontrou resultados
        consecutiveEmptyPages = 0;

        console.log(`[DOU API] 📄 Página ${pageNum + 1} tem ${searchResults.length} resultados (total até agora: ${allResults.length})`);

        // Processar resultados
        for (const content of searchResults) {
          // Validar campos obrigatórios antes de acessar
          if (!content || typeof content !== 'object') continue;

          const pubDate = content.pubDate || '';
          const item: DOUSearchResult = {
            section: (content.pubName || 'do1').toLowerCase(),
            title: stripHighlightHtml(content.title || ''),
            href: content.urlTitle ? this.webBaseUrl + content.urlTitle : '',
            abstract: stripHighlightHtml(content.content || ''),
            date: pubDate,
            id: content.classPK || '',
            hierarchyList: Array.isArray(content.hierarchyList) ? content.hierarchyList : [],
            hierarchyStr: content.hierarchyStr || '',
            artType: content.artType || '',
            score: content.score || 0,
            displayDate: pubDate ? dateToTimestamp(pubDate) : Date.now(),
          };

          allResults.push(item);

          // Verificar se atingiu o limite de resultados
          if (maxResults && allResults.length >= maxResults) {
            console.log(`[DOU API] 🎯 Limite de ${maxResults} resultados atingido`);
            break;
          }
        }

        // Se atingiu o limite, parar de buscar mais páginas
        if (maxResults && allResults.length >= maxResults) {
          break;
        }

        // Rate limiting entre páginas
        if (pageNum < numberPages - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`[DOU API] ✅ ${allResults.length} resultados encontrados`);

      return allResults;

    } catch (error) {
      console.error('[DOU API] ❌ Erro na busca:', error);
      throw error;
    }
  }
}

/**
 * Remove tags HTML de highlight inseridas pela API de busca do DOU
 * Ex: <span class='highlight' style='background:#FFA;'>licitação</span> → licitação
 */
function stripHighlightHtml(text: string): string {
  if (!text) return text;
  return text
    .replace(/<span[^>]*class=['"]?highlight['"]?[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Instância singleton
 */
export const douClient = new DOUClient();

/**
 * Helper: buscar na última semana
 */
export async function searchLastWeek(
  searchTerm: string,
  sections: DOUSection[] = [DOUSection.TODOS],
  maxResults?: number
): Promise<DOUSearchResult[]> {
  console.log(`[DOU API] Buscando última semana`);

  return await douClient.search({
    searchTerm,
    sections,
    period: DOUPeriod.SEMANA,
    field: DOUField.TUDO,
    isExactSearch: false,
    maxResults,
  });
}

/**
 * Helper: buscar no último mês
 */
export async function searchLastMonth(
  searchTerm: string,
  sections: DOUSection[] = [DOUSection.TODOS],
  maxResults?: number
): Promise<DOUSearchResult[]> {
  console.log(`[DOU API] Buscando último mês`);

  return await douClient.search({
    searchTerm,
    sections,
    period: DOUPeriod.MES,
    field: DOUField.TUDO,
    isExactSearch: false,
    maxResults,
  });
}

/**
 * Helper: buscar nos últimos N dias (período personalizado)
 */
export async function searchLastDays(
  searchTerm: string,
  days: number,
  sections: DOUSection[] = [DOUSection.TODOS],
  maxResults?: number
): Promise<DOUSearchResult[]> {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - days);

  const publishFrom = formatDateDDMMYYYY(fromDate);
  const publishTo = formatDateDDMMYYYY(today);

  console.log(`[DOU API] Buscando últimos ${days} dias: ${publishFrom} a ${publishTo}`);

  return await douClient.search({
    searchTerm,
    sections,
    period: DOUPeriod.PERSONALIZADO,
    publishFrom,
    publishTo,
    field: DOUField.TUDO,
    isExactSearch: false,
    maxResults,
  });
}

/**
 * Formatar data para DD-MM-YYYY
 */
function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Converter data DD/MM/YYYY para timestamp em milissegundos
 */
function dateToTimestamp(dateStr: string): number {
  const [day, month, year] = dateStr.split('/');
  const date = new Date(`${year}-${month}-${day}`);
  return date.getTime();
}
