/**
 * Mapeamento de palavras-chave para artigos da Lei 14.133/2021
 * Permite sugerir artigos baseado no tema/conteúdo do documento
 */

export interface KeywordMatch {
  articleNumber: string;
  keywords: string[];
  score: number; // 0-10, quanto maior mais relevante
  reason: string; // Explicação da sugestão
}

/**
 * Mapa de palavras-chave → artigos relacionados
 *
 * Estrutura: { palavra-chave: [artigos, score, razão] }
 */
const KEYWORD_TO_ARTICLES: Record<string, Array<{ articles: string[], score: number, reason: string }>> = {
  // TÍTULO I - DISPOSIÇÕES GERAIS
  'princípio': [
    { articles: ['5'], score: 10, reason: 'Documento trata de princípios da licitação' }
  ],
  'princípios': [
    { articles: ['5'], score: 10, reason: 'Documento trata de princípios da licitação' }
  ],
  'legalidade': [
    { articles: ['5'], score: 8, reason: 'Menciona princípio da legalidade' }
  ],
  'impessoalidade': [
    { articles: ['5'], score: 8, reason: 'Menciona princípio da impessoalidade' }
  ],
  'moralidade': [
    { articles: ['5'], score: 8, reason: 'Menciona princípio da moralidade' }
  ],

  'definição': [
    { articles: ['6'], score: 10, reason: 'Documento trata de definições da lei' }
  ],
  'definições': [
    { articles: ['6'], score: 10, reason: 'Documento trata de definições da lei' }
  ],
  'conceito': [
    { articles: ['6'], score: 9, reason: 'Documento trata de conceitos fundamentais' }
  ],

  'agente de contratação': [
    { articles: ['8'], score: 10, reason: 'Documento trata do agente de contratação' }
  ],
  'comissão de contratação': [
    { articles: ['9'], score: 10, reason: 'Documento trata da comissão de contratação' }
  ],
  'impedimento': [
    { articles: ['12'], score: 9, reason: 'Documento trata de impedimento e suspeição' }
  ],
  'suspeição': [
    { articles: ['12'], score: 9, reason: 'Documento trata de impedimento e suspeição' }
  ],

  // TÍTULO II - DAS LICITAÇÕES
  'planejamento': [
    { articles: ['22', '23', '24', '25'], score: 9, reason: 'Documento trata de planejamento da contratação' }
  ],
  'plano de contratações': [
    { articles: ['22'], score: 10, reason: 'Documento trata do plano de contratações anual' }
  ],
  'estudos técnicos': [
    { articles: ['23'], score: 10, reason: 'Documento trata de estudos técnicos preliminares' }
  ],
  'gestão de riscos': [
    { articles: ['24'], score: 10, reason: 'Documento trata de gestão de riscos' }
  ],

  'modalidade': [
    { articles: ['29', '30', '31', '32', '33', '34'], score: 8, reason: 'Documento trata de modalidades de licitação' }
  ],
  'modalidades': [
    { articles: ['29', '30', '31', '32', '33', '34'], score: 8, reason: 'Documento trata de modalidades de licitação' }
  ],
  'pregão': [
    { articles: ['30'], score: 10, reason: 'Documento trata da modalidade pregão' }
  ],
  'concorrência': [
    { articles: ['31'], score: 10, reason: 'Documento trata da modalidade concorrência' }
  ],
  'concurso': [
    { articles: ['32'], score: 10, reason: 'Documento trata da modalidade concurso' }
  ],
  'leilão': [
    { articles: ['33'], score: 10, reason: 'Documento trata da modalidade leilão' }
  ],
  'diálogo competitivo': [
    { articles: ['34'], score: 10, reason: 'Documento trata do diálogo competitivo' }
  ],

  'menor preço': [
    { articles: ['36'], score: 9, reason: 'Documento trata do critério menor preço' }
  ],
  'maior desconto': [
    { articles: ['36'], score: 9, reason: 'Documento trata do critério maior desconto' }
  ],
  'técnica e preço': [
    { articles: ['39'], score: 10, reason: 'Documento trata do critério técnica e preço' }
  ],

  'edital': [
    { articles: ['42', '43', '44', '45', '46'], score: 8, reason: 'Documento trata do edital de licitação' }
  ],
  'impugnação': [
    { articles: ['44'], score: 10, reason: 'Documento trata de impugnação ao edital' }
  ],
  'habilitação': [
    { articles: ['54', '55', '56', '57', '58', '59'], score: 8, reason: 'Documento trata de habilitação' }
  ],
  'proposta': [
    { articles: ['47', '48', '51', '52', '53'], score: 7, reason: 'Documento trata de propostas' }
  ],

  'dispensa': [
    { articles: ['74', '75'], score: 10, reason: 'Documento trata de dispensa de licitação' }
  ],
  'dispensável': [
    { articles: ['74', '75'], score: 10, reason: 'Documento trata de dispensa de licitação' }
  ],
  'inexigibilidade': [
    { articles: ['72', '73'], score: 10, reason: 'Documento trata de inexigibilidade' }
  ],
  'inexigível': [
    { articles: ['72', '73'], score: 10, reason: 'Documento trata de inexigibilidade' }
  ],
  'contratação direta': [
    { articles: ['72', '73', '74', '75', '76', '77', '78', '79', '80'], score: 9, reason: 'Documento trata de contratação direta' }
  ],

  'registro de preços': [
    { articles: ['81', '82', '83', '84', '85', '86'], score: 10, reason: 'Documento trata do Sistema de Registro de Preços' }
  ],
  'ata de registro': [
    { articles: ['82'], score: 10, reason: 'Documento trata da ata de registro de preços' }
  ],
  'carona': [
    { articles: ['84'], score: 10, reason: 'Documento trata de adesão à ata (carona)' }
  ],

  // TÍTULO III - CONTRATOS
  'contrato': [
    { articles: ['89', '90', '91', '92'], score: 7, reason: 'Documento trata de contratos' }
  ],
  'garantia': [
    { articles: ['95', '96', '97', '98'], score: 9, reason: 'Documento trata de garantia de execução' }
  ],
  'subcontratação': [
    { articles: ['99', '100', '101'], score: 10, reason: 'Documento trata de subcontratação' }
  ],

  'fiscalização': [
    { articles: ['116', '117'], score: 10, reason: 'Documento trata de fiscalização de contratos' }
  ],
  'gestor': [
    { articles: ['118', '119'], score: 10, reason: 'Documento trata do gestor de contratos' }
  ],
  'fiscal': [
    { articles: ['116', '117'], score: 10, reason: 'Documento trata do fiscal de contratos' }
  ],

  'alteração': [
    { articles: ['124', '125', '126', '127', '128'], score: 8, reason: 'Documento trata de alterações contratuais' }
  ],
  'alterações': [
    { articles: ['124', '125', '126', '127', '128'], score: 8, reason: 'Documento trata de alterações contratuais' }
  ],
  'aditivo': [
    { articles: ['124', '125'], score: 9, reason: 'Documento trata de termos aditivos' }
  ],
  'acréscimo': [
    { articles: ['125', '128'], score: 9, reason: 'Documento trata de acréscimos contratuais' }
  ],
  'supressão': [
    { articles: ['125', '128'], score: 9, reason: 'Documento trata de supressões contratuais' }
  ],

  'reequilíbrio': [
    { articles: ['137', '138', '139'], score: 10, reason: 'Documento trata de reequilíbrio econômico-financeiro' }
  ],
  'revisão': [
    { articles: ['138'], score: 9, reason: 'Documento trata de revisão de preços' }
  ],
  'repactuação': [
    { articles: ['139'], score: 10, reason: 'Documento trata de repactuação' }
  ],

  'pagamento': [
    { articles: ['140', '141', '142', '143'], score: 8, reason: 'Documento trata de pagamentos' }
  ],
  'pagamentos': [
    { articles: ['140', '141', '142', '143'], score: 8, reason: 'Documento trata de pagamentos' }
  ],

  'arbitragem': [
    { articles: ['148'], score: 10, reason: 'Documento trata de arbitragem' }
  ],
  'mediação': [
    { articles: ['147'], score: 10, reason: 'Documento trata de mediação e conciliação' }
  ],

  // TÍTULO IV - SANÇÕES
  'sanção': [
    { articles: ['155', '156', '157', '158', '159'], score: 9, reason: 'Documento trata de sanções administrativas' }
  ],
  'sanções': [
    { articles: ['155', '156', '157', '158', '159'], score: 9, reason: 'Documento trata de sanções administrativas' }
  ],
  'multa': [
    { articles: ['157'], score: 10, reason: 'Documento trata de multas' }
  ],
  'advertência': [
    { articles: ['156'], score: 10, reason: 'Documento trata de advertência' }
  ],
  'impedimento de licitar': [
    { articles: ['158'], score: 10, reason: 'Documento trata de impedimento de licitar' }
  ],
  'inidoneidade': [
    { articles: ['159'], score: 10, reason: 'Documento trata de declaração de inidoneidade' }
  ],

  'processo sancionador': [
    { articles: ['160', '161', '162'], score: 10, reason: 'Documento trata do processo administrativo sancionador' }
  ],

  'crime': [
    { articles: ['163', '164', '165', '166', '167'], score: 8, reason: 'Documento trata de crimes em licitações' }
  ],
  'crimes': [
    { articles: ['163', '164', '165', '166', '167'], score: 8, reason: 'Documento trata de crimes em licitações' }
  ],
  'fraude': [
    { articles: ['164', '167'], score: 9, reason: 'Documento trata de fraude em licitação ou contrato' }
  ],

  // ===== PALAVRAS-CHAVE ADICIONAIS (FASE 1) =====

  // Procedimentos e prazos
  'recurso': [
    { articles: ['64', '65', '66'], score: 9, reason: 'Documento trata de recursos administrativos em licitação' }
  ],
  'recursos administrativos': [
    { articles: ['64', '65', '66'], score: 10, reason: 'Documento trata de recursos administrativos' }
  ],
  'prazo': [
    { articles: ['43', '65', '93', '141'], score: 7, reason: 'Documento trata de prazos (propostas, recursos, contratos, pagamentos)' }
  ],
  'prorrogação': [
    { articles: ['93', '94', '129'], score: 9, reason: 'Documento trata de prorrogação de prazo contratual' }
  ],

  // Habilitação e documentação
  'documentação': [
    { articles: ['55', '56', '57', '58', '59'], score: 8, reason: 'Documento trata de documentação de habilitação' }
  ],
  'certidão': [
    { articles: ['57'], score: 9, reason: 'Documento trata de certidões fiscais e trabalhistas' }
  ],
  'regularidade fiscal': [
    { articles: ['57'], score: 10, reason: 'Documento trata de regularidade fiscal e trabalhista' }
  ],
  'qualificação econômica': [
    { articles: ['59'], score: 10, reason: 'Documento trata de qualificação econômico-financeira' }
  ],
  'qualificação técnica': [
    { articles: ['58'], score: 10, reason: 'Documento trata de qualificação técnica' }
  ],

  // Anulação e revogação
  'anulação': [
    { articles: ['67', '68'], score: 10, reason: 'Documento trata de anulação de licitação' }
  ],
  'revogação': [
    { articles: ['67', '69'], score: 10, reason: 'Documento trata de revogação de licitação' }
  ],
  'invalidade': [
    { articles: ['68'], score: 8, reason: 'Documento trata de vícios e invalidades' }
  ],

  // Tipos de objeto
  'obra': [
    { articles: ['18', '27', '31', '178'], score: 7, reason: 'Documento trata de licitação de obras' }
  ],
  'obras': [
    { articles: ['18', '27', '31', '178'], score: 7, reason: 'Documento trata de licitação de obras' }
  ],
  'serviço': [
    { articles: ['18', '30', '31'], score: 7, reason: 'Documento trata de licitação de serviços' }
  ],
  'serviços': [
    { articles: ['18', '30', '31'], score: 7, reason: 'Documento trata de licitação de serviços' }
  ],
  'compra': [
    { articles: ['6', '18', '30'], score: 7, reason: 'Documento trata de licitação de compras' }
  ],
  'compras': [
    { articles: ['6', '18', '30'], score: 7, reason: 'Documento trata de licitação de compras' }
  ],
  'alienação': [
    { articles: ['33', '37'], score: 9, reason: 'Documento trata de alienação de bens' }
  ],

  // Execução contratual
  'rescisão': [
    { articles: ['122', '123'], score: 10, reason: 'Documento trata de rescisão contratual' }
  ],
  'inadimplemento': [
    { articles: ['123'], score: 10, reason: 'Documento trata de inadimplemento contratual' }
  ],
  'inadimplência': [
    { articles: ['123'], score: 10, reason: 'Documento trata de inadimplência contratual' }
  ],
  'extinção': [
    { articles: ['120', '121', '122'], score: 9, reason: 'Documento trata de extinção de contratos' }
  ],
  'recebimento': [
    { articles: ['106', '107', '108'], score: 9, reason: 'Documento trata de recebimento de objeto contratual' }
  ],
  'atesto': [
    { articles: ['106', '107', '108', '117'], score: 9, reason: 'Documento trata de atesto e recebimento' }
  ],

  // Preços e valores
  'preço': [
    { articles: ['36', '62', '78', '103', '104', '138'], score: 7, reason: 'Documento trata de preços e valores' }
  ],
  'orçamento': [
    { articles: ['105'], score: 9, reason: 'Documento trata de orçamento estimado' }
  ],
  'valor estimado': [
    { articles: ['105'], score: 9, reason: 'Documento trata de valor estimado' }
  ],
  'planilha': [
    { articles: ['103', '104'], score: 8, reason: 'Documento trata de planilhas de custos' }
  ],

  // Recursos e soluções alternativas
  'conciliação': [
    { articles: ['147'], score: 10, reason: 'Documento trata de conciliação' }
  ],
  'dispute board': [
    { articles: ['149'], score: 10, reason: 'Documento trata de comitê de resolução de disputas' }
  ],
  'drb': [
    { articles: ['149'], score: 10, reason: 'Documento trata de Dispute Resolution Board' }
  ],

  // Terceirização e ME/EPP
  'terceirização': [
    { articles: ['180', '181'], score: 10, reason: 'Documento trata de terceirização de serviços' }
  ],
  'microempresa': [
    { articles: ['113'], score: 10, reason: 'Documento trata de benefícios para ME/EPP' }
  ],
  'empresa de pequeno porte': [
    { articles: ['113'], score: 10, reason: 'Documento trata de benefícios para ME/EPP' }
  ],
  'epp': [
    { articles: ['113'], score: 10, reason: 'Documento trata de benefícios para EPP' }
  ],

  // Sustentabilidade e preferências
  'sustentabilidade': [
    { articles: ['110'], score: 10, reason: 'Documento trata de critérios de sustentabilidade' }
  ],
  'produto nacional': [
    { articles: ['111', '112'], score: 9, reason: 'Documento trata de preferência para produtos nacionais' }
  ],
  'margem de preferência': [
    { articles: ['111'], score: 10, reason: 'Documento trata de margem de preferência' }
  ],

  // Outros termos importantes
  'adjudicação': [
    { articles: ['63'], score: 10, reason: 'Documento trata de adjudicação' }
  ],
  'homologação': [
    { articles: ['63'], score: 10, reason: 'Documento trata de homologação' }
  ],
  'desclassificação': [
    { articles: ['53'], score: 10, reason: 'Documento trata de desclassificação de propostas' }
  ],
  'inabilitação': [
    { articles: ['60'], score: 10, reason: 'Documento trata de inabilitação de licitantes' }
  ],
  'projeto básico': [
    { articles: ['27'], score: 10, reason: 'Documento trata de projeto básico' }
  ],
  'projeto executivo': [
    { articles: ['27'], score: 10, reason: 'Documento trata de projeto executivo' }
  ],
  'anteprojeto': [
    { articles: ['26'], score: 10, reason: 'Documento trata de anteprojeto' }
  ],

  // ===== PALAVRAS-CHAVE EXPANDIDAS (FASE 2) =====

  // Variações e sinônimos de modalidades
  'menor preço ou maior desconto': [
    { articles: ['36'], score: 10, reason: 'Documento trata do critério menor preço ou maior desconto' }
  ],
  'melhor técnica': [
    { articles: ['38'], score: 10, reason: 'Documento trata do critério melhor técnica' }
  ],
  'conteúdo artístico': [
    { articles: ['38'], score: 10, reason: 'Documento trata de conteúdo artístico' }
  ],

  // Termos de contratação direta - variações
  'emergência': [
    { articles: ['75'], score: 9, reason: 'Documento trata de dispensa por emergência' }
  ],
  'calamidade': [
    { articles: ['75'], score: 9, reason: 'Documento trata de dispensa por calamidade' }
  ],
  'pequeno valor': [
    { articles: ['75'], score: 10, reason: 'Documento trata de dispensa por pequeno valor' }
  ],
  'notória especialização': [
    { articles: ['73'], score: 10, reason: 'Documento trata de inexigibilidade por notória especialização' }
  ],
  'exclusividade': [
    { articles: ['73'], score: 9, reason: 'Documento trata de inexigibilidade por exclusividade' }
  ],
  'fornecedor exclusivo': [
    { articles: ['73'], score: 10, reason: 'Documento trata de fornecedor exclusivo' }
  ],

  // Agentes e estrutura
  'autoridade': [
    { articles: ['7', '13', '63', '80'], score: 7, reason: 'Documento trata de autoridades competentes' }
  ],
  'servidor': [
    { articles: ['7', '10', '11'], score: 7, reason: 'Documento trata de servidores públicos' }
  ],
  'equipe técnica': [
    { articles: ['10'], score: 9, reason: 'Documento trata de equipe de apoio' }
  ],

  // Controle e assessoria
  'assessoria': [
    { articles: ['14'], score: 9, reason: 'Documento trata de assessoramento jurídico' }
  ],
  'consultoria jurídica': [
    { articles: ['14'], score: 9, reason: 'Documento trata de consultoria jurídica' }
  ],
  'controle interno': [
    { articles: ['14', '15', '16'], score: 9, reason: 'Documento trata de controle interno' }
  ],
  'controle externo': [
    { articles: ['14'], score: 8, reason: 'Documento trata de controle' }
  ],
  'tcu': [
    { articles: ['14', '15', '16'], score: 7, reason: 'Documento relacionado a controle externo (TCU)' }
  ],

  // Publicidade e transparência
  'publicação': [
    { articles: ['42', '91'], score: 8, reason: 'Documento trata de publicação de atos' }
  ],
  'portal': [
    { articles: ['42', '191'], score: 8, reason: 'Documento trata de Portal Nacional de Contratações (PNCP)' }
  ],
  'pncp': [
    { articles: ['191', '187'], score: 10, reason: 'Documento trata do Portal Nacional de Contratações Públicas' }
  ],
  'transparência': [
    { articles: ['5', '42', '191'], score: 8, reason: 'Documento trata de transparência e publicidade' }
  ],
  'divulgação': [
    { articles: ['42', '79'], score: 8, reason: 'Documento trata de divulgação de atos' }
  ],

  // Procedimento específicos
  'sessão pública': [
    { articles: ['50', '51'], score: 9, reason: 'Documento trata de sessão pública de licitação' }
  ],
  'lance': [
    { articles: ['37', '47'], score: 8, reason: 'Documento trata de lances em licitação' }
  ],
  'lances': [
    { articles: ['37', '47'], score: 8, reason: 'Documento trata de lances em licitação' }
  ],
  'envelope': [
    { articles: ['48', '49', '50'], score: 9, reason: 'Documento trata de envelopes de proposta/habilitação' }
  ],

  // Julgamento e análise
  'classificação': [
    { articles: ['52'], score: 10, reason: 'Documento trata de classificação de propostas' }
  ],
  'julgamento': [
    { articles: ['35', '51'], score: 9, reason: 'Documento trata de julgamento de propostas' }
  ],
  'critério': [
    { articles: ['35', '36', '37', '38', '39', '40'], score: 7, reason: 'Documento trata de critérios de julgamento' }
  ],
  'análise': [
    { articles: ['23', '25', '51'], score: 6, reason: 'Documento trata de análise (estudos, viabilidade, propostas)' }
  ],

  // Garantias e seguros
  'caução': [
    { articles: ['96'], score: 10, reason: 'Documento trata de caução como garantia' }
  ],
  'fiança': [
    { articles: ['96'], score: 10, reason: 'Documento trata de fiança bancária' }
  ],
  'seguro': [
    { articles: ['96', '177'], score: 9, reason: 'Documento trata de seguro-garantia' }
  ],
  'seguro-garantia': [
    { articles: ['177'], score: 10, reason: 'Documento trata de seguro-garantia' }
  ],

  // Pagamentos e valores
  'nota fiscal': [
    { articles: ['141'], score: 9, reason: 'Documento trata de pagamento via nota fiscal' }
  ],
  'faturamento': [
    { articles: ['140', '141'], score: 8, reason: 'Documento trata de faturamento' }
  ],
  'adiantamento': [
    { articles: ['142'], score: 10, reason: 'Documento trata de antecipação de pagamento' }
  ],
  'antecipação': [
    { articles: ['142'], score: 10, reason: 'Documento trata de antecipação de pagamento' }
  ],
  'juros': [
    { articles: ['143'], score: 9, reason: 'Documento trata de juros de mora' }
  ],
  'mora': [
    { articles: ['143'], score: 9, reason: 'Documento trata de mora/atraso' }
  ],
  'atraso': [
    { articles: ['143', '129'], score: 8, reason: 'Documento trata de atraso (pagamento/prazo)' }
  ],

  // Reajustes e recomposições
  'índice': [
    { articles: ['138', '139'], score: 7, reason: 'Documento trata de índices de reajuste' }
  ],
  'reajuste': [
    { articles: ['138', '139'], score: 9, reason: 'Documento trata de reajuste de preços' }
  ],
  'inflação': [
    { articles: ['138'], score: 7, reason: 'Documento relacionado a correção inflacionária' }
  ],
  'álea': [
    { articles: ['137'], score: 10, reason: 'Documento trata de álea econômica' }
  ],
  'álea econômica': [
    { articles: ['137'], score: 10, reason: 'Documento trata de álea econômica extraordinária' }
  ],

  // Execução e vigência
  'vigência': [
    { articles: ['83', '92', '193'], score: 7, reason: 'Documento trata de vigência de contratos/ata/lei' }
  ],
  'prazo de execução': [
    { articles: ['92', '93'], score: 9, reason: 'Documento trata de prazo de execução' }
  ],
  'conclusão': [
    { articles: ['121', '176'], score: 8, reason: 'Documento trata de conclusão/remanescente' }
  ],

  // Vícios e responsabilidades
  'vício': [
    { articles: ['68', '109'], score: 9, reason: 'Documento trata de vícios (licitação/objeto)' }
  ],
  'defeito': [
    { articles: ['109'], score: 9, reason: 'Documento trata de defeitos/vícios' }
  ],
  'responsabilidade': [
    { articles: ['13', '17', '101', '181'], score: 6, reason: 'Documento trata de responsabilidades' }
  ],

  // Inovação e tecnologia
  'inovação': [
    { articles: ['34', '174'], score: 9, reason: 'Documento trata de inovação e tecnologia' }
  ],
  'pesquisa': [
    { articles: ['174'], score: 9, reason: 'Documento trata de pesquisa e desenvolvimento' }
  ],
  'desenvolvimento': [
    { articles: ['5', '174'], score: 7, reason: 'Documento trata de desenvolvimento (sustentável/tecnológico)' }
  ],
  'encomenda tecnológica': [
    { articles: ['174'], score: 10, reason: 'Documento trata de encomendas tecnológicas' }
  ],

  // Procedimentos auxiliares
  'credenciamento': [
    { articles: ['175'], score: 10, reason: 'Documento trata de credenciamento' }
  ],
  'pré-qualificação': [
    { articles: ['21', '87'], score: 10, reason: 'Documento trata de pré-qualificação permanente' }
  ],
  'cadastro': [
    { articles: ['21', '88'], score: 9, reason: 'Documento trata de registro cadastral' }
  ],

  // Intervenção e medidas excepcionais
  'intervenção': [
    { articles: ['150', '151', '152', '153', '154'], score: 10, reason: 'Documento trata de intervenção em contratos' }
  ],
  'interventor': [
    { articles: ['152'], score: 10, reason: 'Documento trata de designação de interventor' }
  ],

  // Siglas e abreviações comuns
  'srp': [
    { articles: ['81', '82', '83', '84', '85', '86'], score: 10, reason: 'Documento trata do Sistema de Registro de Preços' }
  ],
  'bdi': [
    { articles: ['104'], score: 9, reason: 'Documento trata de BDI (Bonificações e Despesas Indiretas)' }
  ],

  // Termos de engenharia
  'engenharia': [
    { articles: ['178'], score: 9, reason: 'Documento trata de obras e serviços de engenharia' }
  ],
  'fiscal de obra': [
    { articles: ['116', '117'], score: 10, reason: 'Documento trata de fiscal de obras' }
  ],
  'medição': [
    { articles: ['106', '107', '108'], score: 9, reason: 'Documento trata de medição e recebimento' }
  ],

  // Revogações e transições
  'lei 8666': [
    { articles: ['3', '192'], score: 8, reason: 'Documento trata da Lei 8.666/93 (revogada)' }
  ],
  'transição': [
    { articles: ['182', '183', '184'], score: 8, reason: 'Documento trata de normas transitórias' }
  ],
};

/**
 * Analisa texto e sugere artigos baseado em palavras-chave
 */
export function findKeywordMatches(text: string): KeywordMatch[] {
  const textLower = text.toLowerCase();
  const matchMap = new Map<string, KeywordMatch>();

  // Busca todas as palavras-chave no texto
  for (const [keyword, mappings] of Object.entries(KEYWORD_TO_ARTICLES)) {
    if (textLower.includes(keyword.toLowerCase())) {

      for (const mapping of mappings) {
        for (const article of mapping.articles) {

          // Se já existe match para este artigo, aumenta o score
          const existing = matchMap.get(article);
          if (existing) {
            existing.keywords.push(keyword);
            existing.score = Math.min(10, existing.score + Math.floor(mapping.score / 2));
          } else {
            matchMap.set(article, {
              articleNumber: article,
              keywords: [keyword],
              score: mapping.score,
              reason: mapping.reason
            });
          }
        }
      }
    }
  }

  // Converte para array e ordena por score
  return Array.from(matchMap.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * Combina múltiplas keywords e calcula score agregado
 */
export function calculateAggregateScore(matches: KeywordMatch[]): KeywordMatch[] {
  const aggregated = new Map<string, KeywordMatch>();

  for (const match of matches) {
    const existing = aggregated.get(match.articleNumber);

    if (existing) {
      existing.keywords = [...new Set([...existing.keywords, ...match.keywords])];
      existing.score = Math.min(10, existing.score + 1);
    } else {
      aggregated.set(match.articleNumber, { ...match });
    }
  }

  return Array.from(aggregated.values())
    .sort((a, b) => b.score - a.score);
}
