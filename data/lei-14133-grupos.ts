/**
 * Grupos temáticos de artigos da Lei 14.133/2021
 * Facilita navegação e estudo contextualizado
 *
 * ATUALIZAÇÃO: Reorganização completa dos grupos temáticos (novembro/2025)
 * - Total: 22 grupos temáticos
 * - Cobertura: todos os 194 artigos da Lei 14.133/2021
 */

export interface ArticleGroup {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  articles: string[]; // Números dos artigos
}

export const LEI_14133_GRUPOS: ArticleGroup[] = [
  {
    id: 'ambito-aplicacao',
    title: 'Âmbito de Aplicação',
    description: 'Definição do objeto, abrangência e aplicação da Lei 14.133/2021',
    icon: '📜',
    color: 'indigo',
    articles: ['1', '2', '3', '4', '176'],
  },
  {
    id: 'principios',
    title: 'Princípios e Definições',
    description: 'Princípios fundamentais, conceitos básicos e definições aplicáveis às licitações',
    icon: '⚖️',
    color: 'indigo',
    articles: ['5', '6'],
  },
  {
    id: 'agentes',
    title: 'Agentes Públicos',
    description: 'Agente de contratação, comissão de licitação, impedimentos e responsabilidades',
    icon: '👥',
    color: 'purple',
    articles: ['7', '8', '9', '10'],
  },
  {
    id: 'processo-licitatorio',
    title: 'Processo Licitatório',
    description: 'Fases do processo licitatório, habilitação, julgamento, recursos, homologação e adjudicação',
    icon: '📝',
    color: 'green',
    articles: ['11', '12', '13', '14', '15', '16', '17', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '174', '175', '176'],
  },
  {
    id: 'planejamento',
    title: 'Planejamento da Contratação',
    description: 'Estudos preliminares, análise de riscos, estimativa de custos, termo de referência, projeto básico e planejamento estratégico das contratações públicas',
    icon: '📋',
    color: 'blue',
    articles: ['18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '150'],
  },
  {
    id: 'modalidades',
    title: 'Modalidades de Licitação',
    description: 'Pregão, concorrência, concurso, leilão e diálogo competitivo',
    icon: '🏛️',
    color: 'green',
    articles: ['28', '29', '30', '31', '32'],
  },
  {
    id: 'criterios-julgamento',
    title: 'Critérios de Julgamento',
    description: 'Menor preço, melhor técnica ou conteúdo artístico, técnica e preço, maior retorno econômico',
    icon: '📊',
    color: 'cyan',
    articles: ['33', '34', '35', '36', '37', '38', '39'],
  },
  {
    id: 'contratacao-direta',
    title: 'Contratação Direta',
    description: 'Dispensa e inexigibilidade de licitação - hipóteses, procedimentos e vedações',
    icon: '⚡',
    color: 'yellow',
    articles: ['72', '73', '74', '75', '76', '77'],
  },
  {
    id: 'instrumentos',
    title: 'Instrumentos Auxiliares',
    description: 'Sistema de Registro de Preços (SRP), credenciamento, pré-qualificação e outros instrumentos',
    icon: '🔧',
    color: 'purple',
    articles: ['78', '79', '80', '81', '82', '83', '84', '85', '86', '87', '88'],
  },
  {
    id: 'contratos',
    title: 'Contratos Administrativos',
    description: 'Formalização, cláusulas essenciais, vigência, prorrogação, reequilíbrio econômico-financeiro e extinção',
    icon: '📄',
    color: 'orange',
    articles: ['89', '90', '91', '92', '93', '94', '95', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '137', '138', '139'],
  },
  {
    id: 'garantias',
    title: 'Garantias',
    description: 'Garantias contratuais - caução, seguro-garantia, fiança bancária e limites',
    icon: '🛡️',
    color: 'teal',
    articles: ['96', '97', '98', '99', '100', '101', '102'],
  },
  {
    id: 'execucao',
    title: 'Execução e Fiscalização',
    description: 'Fiscal e gestor do contrato, atribuições, responsabilidades e acompanhamento da execução',
    icon: '👁️',
    color: 'blue',
    articles: ['115', '116', '117', '118', '119', '120', '121', '122', '123', '140'],
  },
  {
    id: 'alteracoes',
    title: 'Alterações Contratuais',
    description: 'Acréscimos, supressões, modificações qualitativas e quantitativas do contrato',
    icon: '✏️',
    color: 'amber',
    articles: ['124', '125', '126', '127', '128', '129', '130', '131', '132', '133', '134', '135', '136'],
  },
  {
    id: 'pagamentos',
    title: 'Pagamentos',
    description: 'Prazos de pagamento, antecipação, atrasos, glosas e retenções',
    icon: '💳',
    color: 'teal',
    articles: ['141', '142', '143', '144', '145', '146'],
  },
  {
    id: 'nulidades',
    title: 'Nulidade dos Contratos',
    description: 'Hipóteses de nulidade absoluta e relativa de contratos administrativos',
    icon: '⚠️',
    color: 'red',
    articles: ['147', '148', '149', '150'],
  },
  {
    id: 'controversias',
    title: 'Resolução de Controvérsias',
    description: 'Prevenção de conflitos, mediação, arbitragem e comitês de resolução de disputas',
    icon: '🤝',
    color: 'blue',
    articles: ['151', '152', '153', '154'],
  },
  {
    id: 'sancoes',
    title: 'Sanções Administrativas e Processo Sancionador',
    description: 'Advertência, multa, impedimento, declaração de inidoneidade - instauração, defesa, instrução e julgamento',
    icon: '⚖️',
    color: 'red',
    articles: ['155', '156', '157', '158', '159', '160', '161', '162', '163'],
  },
  {
    id: 'impugnacoes-recursos',
    title: 'Impugnações, Pedidos de Esclarecimento e Recursos',
    description: 'Procedimentos de impugnação ao edital, pedidos de esclarecimento e recursos administrativos',
    icon: '📢',
    color: 'orange',
    articles: ['164', '165', '166', '167', '168'],
  },
  {
    id: 'advocacia-controle',
    title: 'Da Advocacia Pública e dos Órgãos de Controle',
    description: 'Assessoramento jurídico, controle interno, controle externo e competências dos órgãos de controle',
    icon: '🏛️',
    color: 'indigo',
    articles: ['10', '53', '169', '170', '171', '172', '173'],
  },
  {
    id: 'disposicoes-finais',
    title: 'Disposições Finais',
    description: 'Disposições transitórias, prazos de adaptação, revogações e vigência da Lei 14.133/2021',
    icon: '📚',
    color: 'gray',
    articles: ['177', '178', '179', '180', '181', '182', '183', '184', '184-A', '185', '186', '187', '188', '189', '190', '191', '192', '193', '194'],
  },
];

// Mapa de artigo → grupos (para busca reversa)
export const ARTIGO_TO_GRUPOS: Record<string, string[]> = {};

LEI_14133_GRUPOS.forEach(group => {
  group.articles.forEach(articleNum => {
    if (!ARTIGO_TO_GRUPOS[articleNum]) {
      ARTIGO_TO_GRUPOS[articleNum] = [];
    }
    ARTIGO_TO_GRUPOS[articleNum].push(group.id);
  });
});

// Função para obter grupos de um artigo
export function getArticleGroups(articleNum: string): ArticleGroup[] {
  const groupIds = ARTIGO_TO_GRUPOS[articleNum] || [];
  return LEI_14133_GRUPOS.filter(g => groupIds.includes(g.id));
}

// Função para obter grupo por ID
export function getGroupById(groupId: string): ArticleGroup | undefined {
  return LEI_14133_GRUPOS.find(g => g.id === groupId);
}

// Grupos populares (mais usados em cursos e consultas)
export const GRUPOS_POPULARES = [
  'contratacao-direta',
  'planejamento',
  'modalidades',
  'sancoes',
  'alteracoes',
  'execucao',
  'processo-licitatorio',
];
