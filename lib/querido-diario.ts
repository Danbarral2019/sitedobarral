/**
 * Querido Diário API - Cliente para busca no Diário Oficial da União
 *
 * API oficial do projeto Querido Diário (Open Knowledge Brasil)
 * https://queridodiario.ok.org.br
 * API Docs: https://queridodiario.ok.org.br/api/docs
 *
 * Permite buscar publicações no DOU e diários municipais
 * filtradas por palavras-chave relevantes para licitações/contratos.
 */

import { KEYWORDS_RELEVANCIA } from './shared-keywords';

/**
 * Interface para resultados da API Querido Diário
 */
export interface QueridoDiarioGazette {
  id: string;
  territory_id: string;
  date: string; // ISO date: "2024-11-02"
  edition_number: string;
  is_extra_edition: boolean;
  power: string; // "executive", "legislative", "judiciary"
  file_checksum: string;
  file_path: string;
  file_url: string;
  scraped_at: string; // ISO datetime
  created_at: string; // ISO datetime
  territory_name: string;
  state_code: string;
  excerpts: Array<{
    excerpt: string; // Conteúdo do trecho
    highlight: string; // Destaque/título
  }>;
}

/**
 * Parâmetros de busca
 */
export interface QueridoDiarioSearchParams {
  keywords: string[]; // Palavras-chave para busca
  since?: string; // Data inicial (YYYY-MM-DD)
  until?: string; // Data final (YYYY-MM-DD)
  territoryId?: string | string[]; // ID do território (padrão: capitais brasileiras)
  page?: number; // Página (padrão: 1)
  pageSize?: number; // Itens por página (padrão: 10, max: 100)
}

/**
 * Resposta da API
 */
export interface QueridoDiarioResponse {
  total_gazettes: number;
  gazettes: QueridoDiarioGazette[];
}

/**
 * IDs das principais capitais brasileiras para busca
 * (Querido Diário indexa diários municipais, não o DOU federal)
 */
const CAPITAIS_IBGE = [
  '3550308', // São Paulo - SP
  '3304557', // Rio de Janeiro - RJ
  '5300108', // Brasília - DF
  '2927408', // Salvador - BA
  '4106902', // Curitiba - PR
  '3106200', // Belo Horizonte - MG
  '2304400', // Fortaleza - CE
  '1302603', // Manaus - AM
  '2611606', // Recife - PE
  '4314902', // Porto Alegre - RS
];

/**
 * Cliente para busca no Querido Diário
 *
 * Por padrão, busca em capitais brasileiras (Querido Diário indexa diários municipais)
 */
export class QueridoDiarioClient {
  private baseUrl = 'https://api.queridodiario.ok.org.br/api/gazettes';

  /**
   * Busca publicações relevantes para licitações/contratos
   *
   * @param params Parâmetros de busca
   * @returns Gazettes encontradas
   */
  async search(params: QueridoDiarioSearchParams): Promise<QueridoDiarioResponse> {
    const {
      keywords,
      since,
      until,
      territoryId = CAPITAIS_IBGE, // Padrão: capitais brasileiras
      page = 1,
      pageSize = 10
    } = params;

    // Monta query string com OR entre keywords
    const querystring = keywords.map(k => encodeURIComponent(k)).join(' OR ');

    // Monta territoryIds (pode ser string ou array)
    const territoryIds = Array.isArray(territoryId) ? territoryId.join(',') : territoryId;

    // Monta URL da API
    const url = new URL(this.baseUrl);
    url.searchParams.set('querystring', querystring);
    url.searchParams.set('territory_ids', territoryIds);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('page_size', Math.min(pageSize, 100).toString());

    if (since) {
      url.searchParams.set('since', since);
    }

    if (until) {
      url.searchParams.set('until', until);
    }

    console.log(`[Querido Diário] Buscando: ${querystring}`);
    console.log(`[Querido Diário] URL: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: QueridoDiarioResponse = await response.json();

      console.log(`[Querido Diário] ✅ ${data.total_gazettes} publicações encontradas`);

      return data;

    } catch (error) {
      console.error('[Querido Diário] ❌ Erro na busca:', error);
      throw error;
    }
  }

  /**
   * Busca publicações relevantes usando keywords do sistema
   *
   * Usa automaticamente as keywords de alta e média relevância
   * definidas no sistema unificado.
   *
   * Busca em múltiplas capitais brasileiras sequencialmente.
   *
   * @param since Data inicial (YYYY-MM-DD)
   * @param until Data final (YYYY-MM-DD, opcional)
   * @param limit Máximo de resultados (padrão: 50)
   */
  async searchRelevant(
    since: string,
    until?: string,
    limit: number = 50
  ): Promise<QueridoDiarioGazette[]> {
    // Usar keywords de alta relevância (mais específicas)
    const keywords = KEYWORDS_RELEVANCIA.high
      .filter(k => k.length > 5) // Evitar termos muito genéricos
      .slice(0, 20); // Limitar a 20 keywords principais

    console.log(`[Querido Diário] Buscando com ${keywords.length} keywords de alta relevância`);
    console.log(`[Querido Diário] Buscando em ${CAPITAIS_IBGE.length} capitais...`);

    const results: QueridoDiarioGazette[] = [];

    // Buscar em cada capital sequencialmente (a API não suporta múltiplos territórios bem)
    for (const capital of CAPITAIS_IBGE) {
      if (results.length >= limit) break;

      let page = 1;
      const pageSize = 100; // Máximo permitido pela API

      while (results.length < limit) {
        const response = await this.search({
          keywords,
          since,
          until,
          territoryId: capital, // Buscar apenas nesta capital
          page,
          pageSize,
        });

        if (response.gazettes.length === 0) {
          break; // Não há mais resultados nesta capital
        }

        results.push(...response.gazettes);
        page++;

        // Sleep para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

        if (results.length >= limit) {
          break;
        }
      }
    }

    console.log(`[Querido Diário] ✅ Total de ${results.length} publicações encontradas`);
    return results.slice(0, limit);
  }

  /**
   * Busca publicações por palavras-chave personalizadas
   *
   * @param customKeywords Array de palavras-chave
   * @param since Data inicial (YYYY-MM-DD)
   * @param until Data final (YYYY-MM-DD, opcional)
   * @param limit Máximo de resultados (padrão: 50)
   */
  async searchCustom(
    customKeywords: string[],
    since: string,
    until?: string,
    limit: number = 50
  ): Promise<QueridoDiarioGazette[]> {
    console.log(`[Querido Diário] Buscando com keywords personalizadas: ${customKeywords.join(', ')}`);

    const results: QueridoDiarioGazette[] = [];
    let page = 1;
    const pageSize = 100;

    while (results.length < limit) {
      const response = await this.search({
        keywords: customKeywords,
        since,
        until,
        page,
        pageSize,
      });

      if (response.gazettes.length === 0) {
        break;
      }

      results.push(...response.gazettes);
      page++;

      await new Promise(resolve => setTimeout(resolve, 500));

      if (results.length >= limit) {
        break;
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Busca publicações de uma data específica
   *
   * @param date Data (YYYY-MM-DD)
   * @param keywords Palavras-chave (opcional, usa keywords do sistema se não fornecido)
   */
  async searchByDate(
    date: string,
    keywords?: string[]
  ): Promise<QueridoDiarioGazette[]> {
    const searchKeywords = keywords || KEYWORDS_RELEVANCIA.high.slice(0, 20);

    const response = await this.search({
      keywords: searchKeywords,
      since: date,
      until: date,
      pageSize: 100,
    });

    return response.gazettes;
  }
}

/**
 * Instância singleton do cliente
 */
export const queridoDiarioClient = new QueridoDiarioClient();

/**
 * Função helper para buscar publicações dos últimos N dias
 *
 * NOTA: A API Querido Diário pode não estar atualizada até hoje.
 * Usa como referência a data mais recente conhecida (2025-02-07).
 *
 * @param days Número de dias para trás
 * @param limit Máximo de resultados
 */
export async function searchLastDays(days: number, limit: number = 50): Promise<QueridoDiarioGazette[]> {
  // Data mais recente conhecida na API (atualizar periodicamente)
  const latestKnownDate = new Date('2025-02-07');

  const since = new Date(latestKnownDate);
  since.setDate(since.getDate() - days);

  const sinceStr = since.toISOString().split('T')[0];
  const untilStr = latestKnownDate.toISOString().split('T')[0];

  console.log(`[Querido Diário] Buscando de ${sinceStr} até ${untilStr} (últimos ${days} dias a partir de ${untilStr})`);

  return await queridoDiarioClient.searchRelevant(sinceStr, untilStr, limit);
}

/**
 * Função helper para buscar publicações de hoje
 */
export async function searchToday(limit: number = 50): Promise<QueridoDiarioGazette[]> {
  return await searchLastDays(0, limit);
}
