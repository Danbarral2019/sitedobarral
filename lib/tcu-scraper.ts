/**
 * Scraper para Acórdãos do TCU - Versão 2.0
 * Extrai acórdãos do webservice de dados abertos do TCU
 *
 * Endpoint: https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos
 *
 * PADRÃO v2 (2025-11-02):
 * - Keywords unificadas com AGU (lib/shared-keywords.ts)
 * - Sistema de versionamento integrado (tcu-module.ts)
 * - Filtro de relevância obrigatório (só licitações/contratos)
 * - Multi-curso (1 acórdão → vários cursos)
 * - Campos numéricos para ordenação
 * - Conformidade com padrão do banco de dados
 */

import { analyzeRelevanceTCU, suggestCoursesTCU } from './tcu-module';

export interface AcordaoTCU {
  key: string;                  // ID único no TCU
  tipo: string;                 // "Acórdão", "Decisão", etc.
  numeroAcordao: string;        // "1234"
  anoAcordao: string;           // "2024"
  acordaoNumero: number;        // 1234 (inteiro para ordenação)
  acordaoAno: number;           // 2024 (inteiro para ordenação)
  titulo: string;               // Título curto
  sumario: string;              // Descrição completa/ementa
  colegiado: string;            // "Plenário", "1ª Câmara", etc.
  relator: string;              // Nome do ministro relator
  dataSessao: string;           // "15/10/2024"
  situacao: string;             // "Publicado", "Em tramitação", etc.
  urlArquivo?: string;          // URL genérica
  urlArquivoPDF?: string;       // URL do PDF (preferencial)
  urlAcordao?: string;          // URL da página do acórdão
  isRelevant: boolean;          // Se é relevante para licitações/contratos
  relevanceScore: number;       // Score de 0-100
  suggestedCourses: string[];   // IDs dos cursos sugeridos
}

export interface TCUFetchOptions {
  inicio?: number;              // Índice inicial (paginação)
  quantidade?: number;          // Quantidade de resultados (max 500)
  anoInicio?: number;           // Filtro por ano inicial
  anoFim?: number;              // Filtro por ano final
  onlyRelevant?: boolean;       // Filtrar apenas relevantes (padrão: true)
  searchTerm?: string;          // Busca por palavra-chave na ementa/título
}

interface TCUApiItem {
  key?: string;
  tipo?: string;
  numeroAcordao?: string;
  anoAcordao?: string;
  titulo?: string;
  sumario?: string;
  colegiado?: string;
  relator?: string;
  dataSessao?: string;
  situacao?: string;
  urlArquivo?: string;
  urlArquivoPDF?: string;
  urlAcordao?: string;
}

/**
 * Busca acórdãos do webservice do TCU
 */
export async function fetchAcordaosTCU(options: TCUFetchOptions = {}): Promise<AcordaoTCU[]> {
  const {
    inicio = 0,
    quantidade = 100,
    anoInicio,
    anoFim,
    onlyRelevant = true,
    searchTerm
  } = options;

  try {
    console.log('[TCU Scraper] Iniciando busca de acórdãos...');
    console.log('[TCU Scraper] Parâmetros:', { inicio, quantidade, anoInicio, anoFim, onlyRelevant, searchTerm });

    // Construir URL com parâmetros
    const params = new URLSearchParams({
      inicio: inicio.toString(),
      quantidade: quantidade.toString(),
    });

    if (anoInicio) params.append('anoInicio', anoInicio.toString());
    if (anoFim) params.append('anoFim', anoFim.toString());

    const url = `https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos?${params}`;

    console.log('[TCU Scraper] URL:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Resposta do TCU não é um array');
    }

    console.log(`[TCU Scraper] ${data.length} acórdãos recebidos do TCU`);

    // Processar e enriquecer cada acórdão
    const acordaos: AcordaoTCU[] = data.map(item => processAcordao(item));

    console.log(`[TCU Scraper] ${acordaos.length} acórdãos processados`);

    // Filtrar apenas relevantes se solicitado
    let filtered = onlyRelevant ? acordaos.filter(ac => ac.isRelevant) : acordaos;

    if (onlyRelevant) {
      console.log(`[TCU Scraper] ${filtered.length} acórdãos relevantes (${Math.round(filtered.length / acordaos.length * 100)}%)`);
    }

    // Filtrar por palavra-chave se fornecida
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const beforeSearch = filtered.length;

      filtered = filtered.filter(ac => {
        const textToSearch = `${ac.titulo} ${ac.sumario}`.toLowerCase();
        return textToSearch.includes(term);
      });

      console.log(`[TCU Scraper] Filtro de busca "${searchTerm}": ${filtered.length}/${beforeSearch} acórdãos encontrados`);
    }

    return filtered;

  } catch (error) {
    console.error('[TCU Scraper] Erro ao buscar acórdãos:', error);
    throw error;
  }
}

/**
 * Processa um acórdão bruto da API do TCU
 */
function processAcordao(item: TCUApiItem): AcordaoTCU {
  // Extrair número e ano
  const numeroAcordao = item.numeroAcordao || '';
  const anoAcordao = item.anoAcordao || '';
  const acordaoNumero = parseInt(numeroAcordao) || 0;
  const acordaoAno = parseInt(anoAcordao) || 0;

  // Título e sumário
  const titulo = item.titulo || '';
  const sumario = item.sumario || '';

  // Análise de relevância usando keywords unificadas
  const { isRelevant, score } = analyzeRelevanceTCU(titulo, sumario);

  // Sugestão de cursos usando keywords unificadas (apenas se relevante)
  const suggestedCourses = isRelevant ? suggestCoursesTCU(titulo, sumario) : [];

  return {
    key: item.key || '',
    tipo: item.tipo || 'Acórdão',
    numeroAcordao,
    anoAcordao,
    acordaoNumero,
    acordaoAno,
    titulo,
    sumario,
    colegiado: item.colegiado || '',
    relator: item.relator || '',
    dataSessao: item.dataSessao || '',
    situacao: item.situacao || '',
    urlArquivo: item.urlArquivo,
    urlArquivoPDF: item.urlArquivoPDF,
    urlAcordao: item.urlAcordao,
    isRelevant,
    relevanceScore: score,
    suggestedCourses,
  };
}

/**
 * Converte Acórdãos do TCU para formato de documento
 */
export function convertAcordaosToDocuments(
  acordaos: AcordaoTCU[]
): Array<{
  title: string;
  description: string;
  category: string;
  type: string;
  url: string;
  tags: string[];
  isPublic: boolean;
  acordaoNumero: number;
  acordaoAno: number;
  courseIds: string[];  // Múltiplos cursos
}> {
  const documents: Array<{
    title: string;
    description: string;
    category: string;
    type: string;
    url: string;
    tags: string[];
    isPublic: boolean;
    acordaoNumero: number;
    acordaoAno: number;
    courseIds: string[];
  }> = [];

  for (const acordao of acordaos) {
    // Só converte acórdãos relevantes
    if (!acordao.isRelevant) {
      console.log(`[TCU Scraper] Pulando acórdão irrelevante: ${acordao.numeroAcordao}/${acordao.anoAcordao}`);
      continue;
    }

    // Título padronizado: "Acórdão TCU nº XXXX/YYYY"
    const title = `Acórdão TCU nº ${acordao.numeroAcordao}/${acordao.anoAcordao}`;

    // URL: preferir PDF
    const url = acordao.urlArquivoPDF || acordao.urlArquivo || acordao.urlAcordao || '';

    if (!url) {
      console.log(`[TCU Scraper] ⚠️ Sem URL para acórdão ${acordao.numeroAcordao}/${acordao.anoAcordao}`);
      continue;
    }

    // Descrição: sumário completo
    const description = acordao.sumario || acordao.titulo || `Acórdão TCU nº ${acordao.numeroAcordao}/${acordao.anoAcordao}`;

    // Tags
    const tags = [
      'TCU',
      acordao.anoAcordao,
      acordao.colegiado,
      acordao.tipo,
    ];

    documents.push({
      title,
      description,
      category: 'acordao',
      type: acordao.urlArquivoPDF ? 'pdf' : 'link',
      url,
      tags,
      isPublic: true,
      acordaoNumero: acordao.acordaoNumero,
      acordaoAno: acordao.acordaoAno,
      courseIds: acordao.suggestedCourses, // Multi-curso
    });
  }

  return documents;
}

/**
 * Gera estatísticas de importação
 */
export function generateImportStats(acordaos: AcordaoTCU[]): {
  total: number;
  relevant: number;
  irrelevant: number;
  byCourse: Record<string, number>;
  byYear: Record<string, number>;
  avgScore: number;
} {
  const stats = {
    total: acordaos.length,
    relevant: 0,
    irrelevant: 0,
    byCourse: {} as Record<string, number>,
    byYear: {} as Record<string, number>,
    avgScore: 0,
  };

  let totalScore = 0;

  for (const acordao of acordaos) {
    if (acordao.isRelevant) {
      stats.relevant++;

      // Conta por curso
      for (const courseId of acordao.suggestedCourses) {
        stats.byCourse[courseId] = (stats.byCourse[courseId] || 0) + 1;
      }

      // Conta por ano
      stats.byYear[acordao.anoAcordao] = (stats.byYear[acordao.anoAcordao] || 0) + 1;
    } else {
      stats.irrelevant++;
    }

    totalScore += acordao.relevanceScore;
  }

  stats.avgScore = acordaos.length > 0 ? totalScore / acordaos.length : 0;

  return stats;
}

// ==========================================
// ENRIQUECIMENTO DE ACÓRDÃOS DA PLANILHA TCU
// ==========================================

/**
 * Interface para dados enriquecidos de um acórdão (da planilha TCU)
 */
export interface TCUEnrichmentResult {
  success: boolean;
  numeroAcordao: string;
  ementaCompleta?: string;
  textoCompleto?: string;
  linkPDF?: string;
  metadados?: {
    relator?: string;
    dataSessao?: string;
    orgaoJulgador?: string;
    processo?: string;
  };
  error?: string;
}

/**
 * Interface para dados da planilha TCU (entrada)
 */
export interface TCUPlanilhaData {
  enunciado: string;
  area: string;
  tema: string;
  subtema: string;
  acordao: string;
  autorTese: string;
  legislacao: string;
  outrosIndexadores: string;
  tipoProcesso: string;
  data?: string;
}

/**
 * Enriquece um acórdão da planilha TCU buscando dados adicionais
 *
 * Esta função tenta buscar dados complementares que NÃO estão na planilha:
 * - Ementa completa (se for maior que o enunciado)
 * - Texto integral do acórdão
 * - Link do PDF oficial
 * - Metadados adicionais
 */
export async function enrichTCUAcordao(
  planilhaData: TCUPlanilhaData
): Promise<TCUEnrichmentResult> {
  const startTime = Date.now();
  const { acordao, enunciado } = planilhaData;

  console.log(`[TCU Enrichment] Tentando buscar dados adicionais: ${acordao}`);

  try {
    // Tenta buscar na API de dados abertos do TCU
    const apiResult = await tryEnrichFromAPI(acordao);

    const elapsedTime = Date.now() - startTime;

    if (apiResult.success) {
      console.log(`[TCU Enrichment] ✓ Dados encontrados na API em ${elapsedTime}ms`);
      return apiResult;
    } else {
      console.log(`[TCU Enrichment] ℹ Acórdão não encontrado na API (${elapsedTime}ms)`);
      return {
        success: false,
        numeroAcordao: acordao,
        error: 'Acórdão não encontrado na API de dados abertos. Use o campo de link para adicionar manualmente.',
      };
    }

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`[TCU Enrichment] Erro após ${elapsedTime}ms:`, error);

    return {
      success: false,
      numeroAcordao: acordao,
      error: 'Erro ao buscar dados. Use o campo de link para adicionar manualmente.',
    };
  }
}

/**
 * Tenta enriquecer usando a API de dados abertos do TCU
 */
async function tryEnrichFromAPI(numeroAcordao: string): Promise<TCUEnrichmentResult> {
  try {
    // Extrai número e ano do acórdão (ex: "AC-1106/24-P" → numero: 1106, ano: 2024)
    const match = numeroAcordao.match(/(\d+)\/(\d{2,4})/);
    if (!match) {
      return {
        success: false,
        numeroAcordao,
        error: 'Formato de número do acórdão inválido',
      };
    }

    const [, numero, ano] = match;
    let anoCompleto = ano;
    if (ano.length === 2) {
      const anoNum = parseInt(ano);
      anoCompleto = anoNum >= 0 && anoNum <= 50 ? `20${ano}` : `19${ano}`;
    }

    // Busca na API de dados abertos
    const anoInt = parseInt(anoCompleto);
    const acordaos = await fetchAcordaosTCU({
      anoInicio: anoInt,
      anoFim: anoInt,
      quantidade: 500,
      onlyRelevant: false, // Buscar todos
    });

    // Procura o acórdão específico
    const found = acordaos.find(ac =>
      ac.numeroAcordao === numero && ac.anoAcordao === anoCompleto
    );

    if (!found) {
      return {
        success: false,
        numeroAcordao,
        error: 'Acórdão não encontrado na API',
      };
    }

    // Retorna dados da API
    return {
      success: true,
      numeroAcordao,
      ementaCompleta: found.sumario || undefined,
      textoCompleto: undefined, // API não tem texto completo
      linkPDF: found.urlArquivoPDF || found.urlArquivo || undefined,
      metadados: {
        relator: found.relator || undefined,
        dataSessao: found.dataSessao || undefined,
        orgaoJulgador: found.colegiado || undefined,
      },
    };

  } catch (error) {
    console.error('[TCU Enrichment] Erro na API:', error);
    return {
      success: false,
      numeroAcordao,
      error: 'Erro ao buscar na API: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}

/**
 * Tenta enriquecer fazendo scraping do site de jurisprudência do TCU
 *
 * NOTA IMPORTANTE: Esta função faz scraping e pode quebrar se o site mudar.
 * Use como fallback quando a API não retornar dados suficientes.
 */
async function tryEnrichFromWebsite(
  numeroAcordao: string,
  enunciadoExistente: string
): Promise<TCUEnrichmentResult> {
  try {
    // Por enquanto, retorna que não conseguiu buscar do site
    // Isso evita erros e permite que o sistema funcione só com dados da planilha
    // TODO: Implementar scraping real do site quando necessário

    console.log(`[TCU Enrichment] Scraping do site não implementado ainda`);

    return {
      success: false,
      numeroAcordao,
      error: 'Scraping do site ainda não implementado. Use dados da planilha.',
    };

    /*
    // CÓDIGO PLACEHOLDER PARA FUTURO SCRAPING DO SITE:

    const searchURL = `https://pesquisa.apps.tcu.gov.br/pesquisa/jurisprudencia-selecionada`;

    // TODO: Implementar busca e extração real do site
    // 1. Montar URL de busca com número do acórdão
    // 2. Fazer requisição HTTP
    // 3. Parsear HTML com cheerio
    // 4. Extrair: ementa completa, texto integral, PDF, metadados
    // 5. Retornar resultado estruturado

    */

  } catch (error) {
    console.error('[TCU Enrichment] Erro no scraping:', error);
    return {
      success: false,
      numeroAcordao,
      error: 'Erro no scraping: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}

/**
 * Enriquece múltiplos acórdãos em lote com rate limiting
 */
export async function enrichTCUAcordaosBatch(
  planilhaDataList: TCUPlanilhaData[],
  options: {
    delayMs?: number; // Delay entre requisições (default: 1000ms)
    maxConcurrent?: number; // Máximo de requisições simultâneas (default: 3)
    onProgress?: (current: number, total: number, result: TCUEnrichmentResult) => void;
  } = {}
): Promise<TCUEnrichmentResult[]> {
  const {
    delayMs = 1000,
    maxConcurrent = 3,
    onProgress,
  } = options;

  const results: TCUEnrichmentResult[] = [];
  const chunks: TCUPlanilhaData[][] = [];

  // Divide em chunks para processar concorrentemente
  for (let i = 0; i < planilhaDataList.length; i += maxConcurrent) {
    chunks.push(planilhaDataList.slice(i, i + maxConcurrent));
  }

  console.log(`[TCU Enrichment Batch] Processando ${planilhaDataList.length} acórdãos em ${chunks.length} lotes`);

  for (const chunk of chunks) {
    // Processa chunk em paralelo
    const chunkResults = await Promise.all(
      chunk.map(async (data, idx) => {
        // Delay progressivo dentro do chunk
        if (idx > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs * idx));
        }
        return enrichTCUAcordao(data);
      })
    );

    results.push(...chunkResults);

    // Callback de progresso
    if (onProgress) {
      for (const result of chunkResults) {
        onProgress(results.length, planilhaDataList.length, result);
      }
    }

    // Delay entre chunks
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[TCU Enrichment Batch] Concluído: ${successCount}/${results.length} sucessos (${Math.round(successCount / results.length * 100)}%)`);

  return results;
}
