/**
 * AGU Scraper v4 - Tipos Compartilhados
 *
 * Sistema unificado de scraping para todos os tipos de documentos da AGU
 * relacionados a licitações e contratos administrativos.
 */

/**
 * Tipos de documentos disponíveis no site da AGU
 */
export type AGUDocumentType =
  | 'orientacao-normativa'  // Orientações Normativas (ONs)
  | 'parecer-vinculante'    // Pareceres aprovados pelo Presidente
  | 'sumula'                // Súmulas da AGU
  | 'parecer-conuni'        // Pareceres CONUNI (DECOR)
  | 'modelo'                // Modelos de editais e contratos
  | 'guia'                  // Guias e manuais práticos
  | 'nota-tecnica';         // Notas técnicas da CGU

/**
 * Configuração do scraper AGU v4
 */
export interface AGUScraperConfig {
  /** Tipos de documentos a buscar */
  tipos: AGUDocumentType[];

  /** Ano inicial (filtro) */
  anoInicio?: number;

  /** Ano final (filtro) */
  anoFim?: number;

  /** Filtrar apenas documentos relevantes para licitações/contratos */
  filtroRelevancia?: boolean;

  /** Buscar apenas documentos novos (não presentes no banco) */
  apenasNovos?: boolean;

  /** Enviar notificação quando encontrar novos documentos */
  notifyOnNew?: boolean;

  /** Salvar screenshots para debug */
  saveScreenshots?: boolean;

  /** Delay entre requisições (ms) para rate limiting */
  delayMs?: number;

  /** Timeout para carregamento de páginas (ms) */
  timeout?: number;
}

/**
 * Documento AGU unificado
 */
export interface AGUDocument {
  /** Tipo do documento */
  tipo: AGUDocumentType;

  /** Número do documento (se aplicável) */
  numero?: string;

  /** Ano do documento */
  ano?: number;

  /** Número como inteiro (para ordenação) */
  numeroInt?: number;

  /** Título do documento */
  titulo: string;

  /** Descrição/ementa completa */
  descricao: string;

  /** URL principal do documento */
  url: string;

  /** URL direta do PDF (se disponível) */
  urlPDF?: string;

  /** URLs alternativas (fundamentações múltiplas, versões históricas) */
  urlsAlternativas?: string[];

  /** Tags extraídas do conteúdo */
  tags: string[];

  /** Data de publicação */
  dataPublicacao?: string;

  /** Data da sessão/aprovação */
  dataSessao?: string;

  /** Órgão emissor/colegiado */
  orgao?: string;

  /** Autor/relator */
  autor?: string;

  /** Se é relevante para licitações/contratos */
  isRelevante: boolean;

  /** Score de relevância (0-100) */
  relevanciaScore: number;

  /** Temas identificados */
  temas: string[];

  /** Cursos sugeridos (IDs) */
  cursosIds: string[];

  /** Observações adicionais */
  observacoes?: string;

  /** Se é uma versão histórica/revogada */
  versaoHistorica?: string;

  /** Sistema de Links DOU (Diário Oficial da União) - flat fields */
  douUrl?: string;        // URL da publicação no DOU
  douData?: string;       // Data de publicação no DOU (formato: DD/MM/YYYY)
  douSecao?: string;      // Seção do DOU (1, 2, 3)
  douPagina?: string;     // Página no DOU
  douEdicao?: string;     // Edição/número do DOU

  /** Satellite table metaDou (mirrors flat DOU fields for normalized access) */
  metaDou?: {
    url?: string;
    data?: string;
    secao?: string;
    pagina?: string;
    edicao?: string;
  };
}

/**
 * Resultado do scraping
 */
export interface AGUScraperResult {
  /** Status geral */
  success: boolean;

  /** Tipo de documento buscado */
  tipo: AGUDocumentType;

  /** Documentos encontrados */
  documentos: AGUDocument[];

  /** Total encontrado */
  total: number;

  /** Total relevante */
  totalRelevante: number;

  /** Tempo de execução (ms) */
  executionTime: number;

  /** Erros encontrados */
  errors: string[];

  /** Avisos */
  warnings: string[];

  /** Screenshot path (se salvo) */
  screenshotPath?: string;
}

/**
 * Estatísticas agregadas do scraping
 */
export interface AGUScraperStats {
  /** Total de documentos por tipo */
  porTipo: Record<AGUDocumentType, number>;

  /** Total de documentos por ano */
  porAno: Record<string, number>;

  /** Total de documentos por curso */
  porCurso: Record<string, number>;

  /** Total de documentos por tema */
  porTema: Record<string, number>;

  /** Taxa de relevância (%) */
  taxaRelevancia: number;

  /** Score médio de relevância */
  scoreMedio: number;

  /** Total geral */
  totalGeral: number;

  /** Total relevante */
  totalRelevante: number;

  /** Tempo total de execução (ms) */
  tempoTotal: number;
}

/**
 * Palavras-chave para análise de relevância
 */
export const KEYWORDS_RELEVANCIA = {
  // Alta relevância (peso 10)
  high: [
    'licitação', 'licitacao', 'pregão', 'pregao', 'tomada de preços',
    'concorrência', 'concorrencia', 'registro de preços', 'edital',
    'lei 14.133', 'lei 8.666', 'dispensa', 'inexigibilidade',
    'contrato', 'contratação', 'contratacao',
  ],

  // Média relevância (peso 5)
  medium: [
    'gestão contratual', 'gestao contratual', 'fiscalização', 'fiscalizacao',
    'sanção', 'sancao', 'penalidade', 'multa', 'impedimento',
    'planejamento', 'estudo técnico preliminar', 'termo de referência',
    'terceirização', 'tercerizacao', 'mão de obra', 'mao de obra',
    'alteração contratual', 'alteracao contratual', 'reajuste', 'repactuação', 'repactuacao',
  ],

  // Baixa relevância (peso 2)
  low: [
    'convênio', 'convenio', 'parceria', 'acordo', 'cooperação', 'cooperacao',
    'administrativo', 'direito público', 'direito publico',
  ],

  // Exclusão (peso -15)
  exclude: [
    'aposentadoria', 'pensão', 'pensao', 'férias', 'ferias',
    'gratificação', 'gratificacao', 'adicional', 'ressarcimento',
    'diária', 'diaria', 'passagem', 'viagem',
    'criminal', 'penal', 'trabalhista', 'tributário', 'tributario',
  ],
};

/**
 * Mapeamento de temas para identificação
 */
export const TEMAS_MAP = {
  'licitacao': 'Licitações',
  'pregao': 'Pregão Eletrônico',
  'dispensa': 'Contratação Direta',
  'contrato': 'Contratos Administrativos',
  'fiscalizacao': 'Fiscalização de Contratos',
  'registro-precos': 'Sistema de Registro de Preços',
  'lei-14133': 'Lei 14.133/2021',
  'lei-8666': 'Lei 8.666/93',
  'terceirizacao': 'Terceirização',
  'reajuste': 'Reajuste e Repactuação',
  'planejamento': 'Planejamento de Contratações',
  'sancao': 'Sanções Administrativas',
  'convenio': 'Convênios e Parcerias',
  'sustentabilidade': 'Licitações Sustentáveis',
};

/**
 * Mapeamento de palavras-chave para cursos
 */
export const CURSOS_KEYWORDS: Record<string, string[]> = {
  '1': [ // Nova Lei de Licitações
    'lei 14.133', 'lei 14133', 'nova lei', 'pregão eletrônico',
    'registro de preços', 'srp',
  ],
  '2': [ // Planejamento das Contratações
    'planejamento', 'estudo técnico preliminar', 'etp', 'dfd',
    'termo de referência', 'projeto básico', 'análise de risco',
  ],
  '3': [ // Gestão e Fiscalização de Contratos
    'gestão contratual', 'gestao contratual', 'fiscalização',
    'fiscalizacao', 'acompanhamento', 'recebimento',
  ],
  '4': [ // Processo Sancionador
    'sanção', 'sancao', 'penalidade', 'multa', 'impedimento',
    'declaração de inidoneidade', 'processo administrativo sancionador',
  ],
  '5': [ // Inovação nas Contratações
    'inovação', 'inovacao', 'tecnologia', 'startup', 'encomenda tecnológica',
  ],
  '6': [ // Terceirização e Formação de Preços
    'terceirização', 'tercerizacao', 'mão de obra', 'mao de obra',
    'dedicação exclusiva', 'formação de preços', 'planilha de custos',
    'bdi', 'encargos sociais',
  ],
  '7': [ // Assessoramento Jurídico
    'parecer', 'assessoramento', 'consultoria jurídica', 'orientação',
    'análise jurídica',
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

/**
 * URLs base para cada tipo de documento
 */
export const AGU_URLS: Record<AGUDocumentType, string> = {
  'orientacao-normativa': 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu',
  'parecer-vinculante': 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceresvinculantes',
  'parecer-conuni': 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/despachos-do-consultor-geral-da-uniao-decor',
  'sumula': 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/sumula',
  'modelo': 'https://www.gov.br/agu/pt-br/assuntos-1/modelos-de-convenios-licitacoes-e-contratos/modelos-de-licitacoes-e-contratos-1',
  'guia': 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/manuais',
  'nota-tecnica': 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/notas-tecnicas',
};
