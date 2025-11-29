/**
 * Mapeamento de temas/palavras-chave para artigos relacionados na Lei 14.133/2021
 * Usado para busca cross-article quando a pergunta envolve temas de outros artigos
 */

export interface CrossReference {
  keywords: string[];
  articles: string[];
  topic: string;
}

export const CROSS_REFERENCES: CrossReference[] = [
  // Alterações Contratuais
  {
    topic: 'Alterações Contratuais',
    keywords: ['alteração contratual', 'alteração do contrato', 'alterar contrato', 'acréscimo', 'supressão', 'aditivo', 'termo aditivo', 'modificação contratual', 'reequilíbrio', 'equilíbrio econômico-financeiro', 'revisão contratual', 'repactuação'],
    articles: ['124', '125', '126', '127', '128', '129', '130', '131', '132', '133', '134', '135', '136'],
  },

  // Prorrogação
  {
    topic: 'Prorrogação Contratual',
    keywords: ['prorrogação', 'prorrogar', 'prazo do contrato', 'extensão de prazo', 'vigência', 'renovação'],
    articles: ['105', '106', '107', '108', '109', '110', '111', '112', '113', '114'],
  },

  // Garantias
  {
    topic: 'Garantias Contratuais',
    keywords: ['garantia', 'caução', 'seguro-garantia', 'fiança bancária', 'garantia contratual', 'garantia de execução'],
    articles: ['96', '97', '98', '99', '100', '101', '102', '103'],
  },

  // Extinção
  {
    topic: 'Extinção do Contrato',
    keywords: ['extinção', 'rescisão', 'encerramento', 'término', 'anulação', 'inadimplemento', 'inexecução'],
    articles: ['137', '138', '139'],
  },

  // Penalidades/Sanções
  {
    topic: 'Penalidades e Sanções',
    keywords: ['penalidade', 'sanção', 'multa', 'advertência', 'suspensão', 'impedimento', 'declaração de inidoneidade', 'punição', 'infração'],
    articles: ['155', '156', '157', '158', '159', '160', '161', '162', '163'],
  },

  // Fiscalização
  {
    topic: 'Fiscalização e Gestão',
    keywords: ['fiscal', 'fiscalização', 'gestor', 'gestão do contrato', 'acompanhamento', 'medição', 'atesto'],
    articles: ['117', '118', '119', '120', '121'],
  },

  // Pagamento
  {
    topic: 'Pagamento',
    keywords: ['pagamento', 'liquidação', 'nota fiscal', 'fatura', 'empenho', 'prazo de pagamento'],
    articles: ['141', '142', '143', '144'],
  },

  // Subcontratação
  {
    topic: 'Subcontratação',
    keywords: ['subcontratação', 'subcontratar', 'subcontratado', 'terceirização'],
    articles: ['122', '123'],
  },

  // Dispensa e Inexigibilidade
  {
    topic: 'Dispensa e Inexigibilidade',
    keywords: ['dispensa', 'inexigibilidade', 'contratação direta', 'licitação dispensável', 'licitação inexigível', 'notória especialização', 'exclusividade'],
    articles: ['74', '75', '76', '77', '78', '79', '80', '81'],
  },

  // Modalidades
  {
    topic: 'Modalidades de Licitação',
    keywords: ['pregão', 'concorrência', 'concurso', 'leilão', 'diálogo competitivo', 'modalidade'],
    articles: ['28', '29', '30', '31', '32'],
  },

  // Habilitação
  {
    topic: 'Habilitação',
    keywords: ['habilitação', 'qualificação técnica', 'qualificação econômica', 'regularidade fiscal', 'atestado', 'certidão'],
    articles: ['62', '63', '64', '65', '66', '67', '68', '69', '70'],
  },

  // Sistema de Registro de Preços
  {
    topic: 'Sistema de Registro de Preços',
    keywords: ['registro de preços', 'srp', 'ata de registro', 'carona', 'adesão'],
    articles: ['82', '83', '84', '85', '86'],
  },

  // Critérios de Julgamento
  {
    topic: 'Critérios de Julgamento',
    keywords: ['critério de julgamento', 'menor preço', 'maior desconto', 'melhor técnica', 'técnica e preço'],
    articles: ['33', '34', '35', '36', '37', '38', '39'],
  },

  // Planejamento
  {
    topic: 'Planejamento da Contratação',
    keywords: ['planejamento', 'etp', 'estudo técnico preliminar', 'termo de referência', 'projeto básico', 'plano de contratações'],
    articles: ['18', '19', '20', '21', '22', '23', '24', '25', '26', '27'],
  },

  // Princípios
  {
    topic: 'Princípios',
    keywords: ['princípio', 'legalidade', 'impessoalidade', 'moralidade', 'publicidade', 'eficiência', 'economicidade', 'competitividade'],
    articles: ['5'],
  },

  // Recursos
  {
    topic: 'Recursos Administrativos',
    keywords: ['recurso', 'impugnação', 'pedido de esclarecimento', 'contrarrazões'],
    articles: ['165', '166', '167', '168'],
  },

  // ME/EPP
  {
    topic: 'Tratamento Diferenciado ME/EPP',
    keywords: ['microempresa', 'empresa de pequeno porte', 'me/epp', 'tratamento diferenciado', 'empate ficto', 'cota reservada'],
    articles: ['48', '49', '50', '51', '52'],
  },

  // Formalização do Contrato
  {
    topic: 'Formalização do Contrato',
    keywords: ['cláusulas obrigatórias', 'formalização', 'instrumento contratual', 'minuta', 'assinatura do contrato'],
    articles: ['89', '90', '91', '92', '93', '94', '95'],
  },

  // Obras e Serviços de Engenharia
  {
    topic: 'Obras e Serviços de Engenharia',
    keywords: ['obra', 'engenharia', 'projeto executivo', 'bim', 'construção', 'edificação', 'reforma'],
    articles: ['45', '46', '47'],
  },
];

/**
 * Normaliza uma string removendo acentos e convertendo para minúsculas
 * @param str - String a ser normalizada
 * @returns String normalizada
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacríticos (acentos)
}

/**
 * Encontra artigos relacionados com base na pergunta do usuário
 * @param question - A pergunta do usuário
 * @param currentArticle - O artigo atual (para não incluí-lo nos resultados)
 * @returns Array de números de artigos relacionados
 */
export function findRelatedArticles(question: string, currentArticle: string): { articles: string[], topics: string[] } {
  const questionNormalized = normalizeString(question);
  const relatedArticles = new Set<string>();
  const matchedTopics = new Set<string>();

  for (const ref of CROSS_REFERENCES) {
    // Verifica se alguma palavra-chave está na pergunta (normalizada)
    const hasMatch = ref.keywords.some(keyword =>
      questionNormalized.includes(normalizeString(keyword))
    );

    if (hasMatch) {
      matchedTopics.add(ref.topic);
      for (const article of ref.articles) {
        // Não incluir o artigo atual
        if (article !== currentArticle) {
          relatedArticles.add(article);
        }
      }
    }
  }

  return {
    articles: Array.from(relatedArticles).slice(0, 5), // Limitar a 5 artigos
    topics: Array.from(matchedTopics),
  };
}

/**
 * Verifica se a pergunta provavelmente envolve temas de outros artigos
 * @param question - A pergunta do usuário
 * @returns true se a pergunta parece envolver outros temas
 */
export function questionInvolvesOtherTopics(question: string): boolean {
  const questionNormalized = normalizeString(question);

  for (const ref of CROSS_REFERENCES) {
    if (ref.keywords.some(keyword =>
      questionNormalized.includes(normalizeString(keyword))
    )) {
      return true;
    }
  }

  return false;
}
