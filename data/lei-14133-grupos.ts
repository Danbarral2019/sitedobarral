/**
 * Grupos temáticos de artigos da Lei 14.133/2021
 * Facilita navegação e estudo contextualizado
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
    id: 'planejamento',
    title: 'Planejamento da Contratação',
    description: 'Estudos preliminares, análise de riscos, estimativa de custos e planejamento estratégico das contratações públicas',
    icon: '📋',
    color: 'blue',
    articles: ['18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28'],
  },
  {
    id: 'contratacao-direta',
    title: 'Contratação Direta',
    description: 'Dispensa e inexigibilidade de licitação - hipóteses, procedimentos e vedações',
    icon: '⚡',
    color: 'yellow',
    articles: ['72', '73', '74', '75', '76', '77', '78', '79', '80'],
  },
  {
    id: 'modalidades',
    title: 'Modalidades de Licitação',
    description: 'Pregão, concorrência, concurso, leilão e diálogo competitivo',
    icon: '🏛️',
    color: 'green',
    articles: ['29', '30', '31', '32', '33', '34'],
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
    description: 'Agente de contratação, comissão, impedimentos e responsabilidades',
    icon: '👥',
    color: 'purple',
    articles: ['7', '8', '9', '10', '11', '12', '13'],
  },
  {
    id: 'criterios-julgamento',
    title: 'Critérios de Julgamento',
    description: 'Menor preço, técnica e preço, melhor técnica, maior retorno econômico',
    icon: '📊',
    color: 'cyan',
    articles: ['35', '36', '37', '38', '39', '40'],
  },
  {
    id: 'procedimento',
    title: 'Procedimento Licitatório',
    description: 'Fases, prazos, habilitação, julgamento, recursos e homologação',
    icon: '📝',
    color: 'green',
    articles: ['41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71'],
  },
  {
    id: 'srp',
    title: 'Sistema de Registro de Preços',
    description: 'Ata de registro, vigência, adesão (carona) e cancelamento',
    icon: '💰',
    color: 'emerald',
    articles: ['81', '82', '83', '84', '85', '86'],
  },
  {
    id: 'contratos',
    title: 'Contratos Administrativos',
    description: 'Formalização, cláusulas essenciais, garantias e prazos',
    icon: '📄',
    color: 'orange',
    articles: ['89', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114'],
  },
  {
    id: 'execucao',
    title: 'Execução e Fiscalização',
    description: 'Fiscal e gestor do contrato, atribuições e responsabilidades',
    icon: '👁️',
    color: 'blue',
    articles: ['115', '116', '117', '118', '119', '120', '121', '122', '123'],
  },
  {
    id: 'alteracoes',
    title: 'Alterações Contratuais',
    description: 'Acréscimos, supressões, prorrogação e modificações',
    icon: '✏️',
    color: 'amber',
    articles: ['124', '125', '126', '127', '128', '129', '130', '131', '132', '133', '134', '135', '136'],
  },
  {
    id: 'reequilibrio',
    title: 'Reequilíbrio Econômico-Financeiro',
    description: 'Revisão, reajuste e repactuação de preços contratuais',
    icon: '💵',
    color: 'green',
    articles: ['137', '138', '139'],
  },
  {
    id: 'pagamentos',
    title: 'Pagamentos',
    description: 'Prazos, antecipação, atrasos e retenções',
    icon: '💳',
    color: 'teal',
    articles: ['140', '141', '142', '143', '144'],
  },
  {
    id: 'controversias',
    title: 'Resolução de Controvérsias',
    description: 'Prevenção de conflitos, mediação, arbitragem e comitês',
    icon: '🤝',
    color: 'blue',
    articles: ['145', '146', '147', '148', '149'],
  },
  {
    id: 'intervencao',
    title: 'Intervenção',
    description: 'Assunção temporária da execução pela Administração',
    icon: '⚠️',
    color: 'red',
    articles: ['150', '151', '152', '153', '154'],
  },
  {
    id: 'sancoes',
    title: 'Sanções Administrativas',
    description: 'Advertência, multa, impedimento e declaração de inidoneidade',
    icon: '⚖️',
    color: 'red',
    articles: ['155', '156', '157', '158', '159'],
  },
  {
    id: 'processo-sancionador',
    title: 'Processo Sancionador',
    description: 'Instauração, defesa, instrução e julgamento',
    icon: '⚖️',
    color: 'red',
    articles: ['160', '161', '162'],
  },
  {
    id: 'crimes',
    title: 'Crimes e Infrações Penais',
    description: 'Tipificação penal de condutas ilícitas em licitações',
    icon: '🚨',
    color: 'red',
    articles: ['163', '164', '165', '166', '167', '168', '169', '170', '171', '172', '173'],
  },
  {
    id: 'instrumentos',
    title: 'Instrumentos Auxiliares',
    description: 'Encomendas tecnológicas, credenciamento, seguro-garantia',
    icon: '🔧',
    color: 'purple',
    articles: ['174', '175', '176', '177', '178', '179'],
  },
  {
    id: 'terceirizacao',
    title: 'Terceirização',
    description: 'Contratação de serviços terceirizados e responsabilidade',
    icon: '👷',
    color: 'gray',
    articles: ['180', '181'],
  },
  {
    id: 'orgaos-controle',
    title: 'Órgãos de Controle',
    description: 'Assessoramento jurídico, controle interno e vedações',
    icon: '🏛️',
    color: 'indigo',
    articles: ['14', '15', '16', '17'],
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

// Grupos populares (mais usados em cursos)
export const GRUPOS_POPULARES = [
  'contratacao-direta',
  'planejamento',
  'modalidades',
  'sancoes',
  'alteracoes',
  'execucao',
];
