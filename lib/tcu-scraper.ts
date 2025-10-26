/**
 * Scraper para Acórdãos do TCU - Versão 1.0
 * Extrai acórdãos do webservice de dados abertos do TCU
 *
 * Endpoint: https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos
 *
 * PADRÃO v3 (2025-10-26):
 * - Filtro de relevância obrigatório (só licitações/contratos)
 * - Multi-curso (1 acórdão → vários cursos)
 * - Campos numéricos para ordenação
 * - Conformidade com padrão do banco de dados
 */

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
    onlyRelevant = true
  } = options;

  try {
    console.log('[TCU Scraper] Iniciando busca de acórdãos...');
    console.log('[TCU Scraper] Parâmetros:', { inicio, quantidade, anoInicio, anoFim, onlyRelevant });

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
    if (onlyRelevant) {
      const relevant = acordaos.filter(ac => ac.isRelevant);
      console.log(`[TCU Scraper] ${relevant.length} acórdãos relevantes (${Math.round(relevant.length / acordaos.length * 100)}%)`);
      return relevant;
    }

    return acordaos;

  } catch (error) {
    console.error('[TCU Scraper] Erro ao buscar acórdãos:', error);
    throw error;
  }
}

/**
 * Processa um acórdão bruto da API do TCU
 */
function processAcordao(item: any): AcordaoTCU {
  // Extrair número e ano
  const numeroAcordao = item.numeroAcordao || '';
  const anoAcordao = item.anoAcordao || '';
  const acordaoNumero = parseInt(numeroAcordao) || 0;
  const acordaoAno = parseInt(anoAcordao) || 0;

  // Título e sumário
  const titulo = item.titulo || '';
  const sumario = item.sumario || '';

  // Análise de relevância
  const { isRelevant, score } = analyzeRelevance(titulo, sumario);

  // Sugestão de cursos (apenas se relevante)
  const suggestedCourses = isRelevant ? suggestCourses(titulo, sumario) : [];

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
 * Analisa se um acórdão é relevante para licitações/contratos
 */
function analyzeRelevance(titulo: string, sumario: string): { isRelevant: boolean; score: number } {
  const text = `${titulo} ${sumario}`.toLowerCase();

  // Palavras-chave de alta relevância (peso 10)
  const highRelevanceKeywords = [
    'licitação', 'licitacao', 'pregão', 'pregao', 'tomada de preços',
    'concorrência', 'concorrencia', 'registro de preços', 'edital',
    'lei 14.133', 'lei 8.666', 'dispensa', 'inexigibilidade',
    'contrato', 'contratação', 'contratacao',
  ];

  // Palavras-chave de média relevância (peso 5)
  const mediumRelevanceKeywords = [
    'gestão contratual', 'fiscalização', 'fiscalizacao',
    'sanção', 'sancao', 'penalidade', 'multa', 'impedimento',
    'planejamento', 'estudo técnico preliminar', 'termo de referência',
    'terceirização', 'tercerizacao', 'mão de obra',
    'alteração contratual', 'reajuste', 'repactuação',
  ];

  // Palavras-chave de exclusão (reduz score)
  const exclusionKeywords = [
    'aposentadoria', 'pensão', 'pensao', 'férias', 'ferias',
    'gratificação', 'gratificacao', 'adicional', 'ressarcimento',
    'diária', 'diaria', 'passagem', 'viagem',
  ];

  let score = 0;

  // Conta high relevance
  for (const keyword of highRelevanceKeywords) {
    if (text.includes(keyword)) {
      score += 10;
    }
  }

  // Conta medium relevance
  for (const keyword of mediumRelevanceKeywords) {
    if (text.includes(keyword)) {
      score += 5;
    }
  }

  // Desconta exclusions
  for (const keyword of exclusionKeywords) {
    if (text.includes(keyword)) {
      score -= 15;
    }
  }

  // Normaliza score para 0-100
  score = Math.max(0, Math.min(100, score));

  // Considera relevante se score >= 10
  const isRelevant = score >= 10;

  return { isRelevant, score };
}

/**
 * Sugere cursos para um acórdão baseado no conteúdo
 */
function suggestCourses(titulo: string, sumario: string): string[] {
  const text = `${titulo} ${sumario}`.toLowerCase();
  const courses = new Set<string>();

  // Mapeamento de palavras-chave → cursos
  const courseKeywords: Record<string, string[]> = {
    '1': [ // Nova Lei de Licitações
      'lei 14.133', 'lei 14133', 'pregão eletrônico', 'pregao eletronico',
      'sistema de registro de preços', 'srp', 'nova lei',
    ],
    '2': [ // Planejamento das Contratações
      'planejamento', 'estudo técnico preliminar', 'etp', 'dfd',
      'termo de referência', 'projeto básico', 'análise de risco',
    ],
    '3': [ // Gestão e Fiscalização de Contratos
      'gestão contratual', 'gestao contratual', 'fiscalização',
      'fiscalizacao', 'acompanhamento contratual', 'recebimento',
    ],
    '4': [ // Processo Sancionador
      'sanção', 'sancao', 'penalidade', 'multa', 'impedimento',
      'declaração de inidoneidade', 'processo administrativo sancionador',
    ],
    '6': [ // Terceirização e Formação de Preços
      'terceirização', 'tercerizacao', 'mão de obra', 'mao de obra',
      'dedicação exclusiva', 'formação de preços', 'planilha de custos',
      'bdi', 'encargos sociais',
    ],
    '8': [ // Revisão, Reajuste e Repactuação
      'reajuste', 'repactuação', 'repactuacao', 'equilíbrio econômico',
      'equilibrio economico', 'revisão contratual', 'revisao contratual',
    ],
    '9': [ // Alterações Contratuais
      'alteração contratual', 'alteracao contratual', 'aditivo',
      'prorrogação', 'prorrogacao', 'acréscimo', 'acrescimo', 'supressão',
    ],
    '10': [ // Contratação Direta
      'dispensa', 'inexigibilidade', 'contratação direta', 'contratacao direta',
      'emergência', 'emergencia', 'notório saber', 'notorio saber',
    ],
  };

  // Para cada curso, verifica se alguma palavra-chave está presente
  for (const [courseId, keywords] of Object.entries(courseKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        courses.add(courseId);
        break; // Já encontrou match, próximo curso
      }
    }
  }

  // Se não encontrou nenhum curso específico mas é relevante, adiciona curso 1 (mais genérico)
  if (courses.size === 0) {
    courses.add('1'); // Nova Lei de Licitações como padrão
  }

  return Array.from(courses);
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
