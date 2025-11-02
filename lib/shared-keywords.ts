/**
 * Keywords Unificadas - AGU + TCU
 *
 * Sistema unificado de análise de relevância para documentos
 * jurídicos sobre licitações e contratos administrativos.
 *
 * Usado por:
 * - AGU Scraper v4 (Pareceres, DECOR, Súmulas)
 * - TCU Scraper v2 (Acórdãos)
 */

/**
 * Keywords de relevância organizadas por peso
 */
export const KEYWORDS_RELEVANCIA = {
  /**
   * Alta relevância (+10 pontos cada)
   * Termos centrais de licitações e contratos
   */
  high: [
    // Modalidades de licitação
    'licitação', 'licitacao',
    'pregão', 'pregao',
    'concorrência', 'concorrencia',
    'tomada de preços', 'tomada de precos',
    'concurso',
    'diálogo competitivo', 'dialogo competitivo',

    // Contratação direta
    'dispensa',
    'dispensa eletrônica', 'dispensa eletronica',
    'inexigibilidade',

    // Contratos
    'contrato',
    'contratação', 'contratacao',
    'contratação direta', 'contratacao direta',

    // Legislação base
    'lei 14.133', 'lei 14133', 'lei nº 14.133', 'lei n° 14.133',
    'lei 8.666', 'lei 8666', 'lei nº 8.666', 'lei n° 8.666',
    'decreto 11.462', 'decreto 11462',

    // Sistemas e procedimentos
    'registro de preços', 'registro de precos',
    'sistema de registro de preços', 'srp',
    'edital',
    'proposta',
    'habilitação', 'habilitacao',
    'credenciamento',
    'pré-qualificação', 'pre-qualificacao',
  ],

  /**
   * Média relevância (+5 pontos cada)
   * Termos relacionados à gestão e execução
   */
  medium: [
    // Gestão e fiscalização
    'gestão contratual', 'gestao contratual',
    'fiscalização', 'fiscalizacao',
    'fiscal de contrato',
    'gestor de contrato',
    'acompanhamento contratual',
    'recebimento',

    // Planejamento
    'planejamento',
    'estudo técnico preliminar', 'etp',
    'termo de referência', 'termo de referencia',
    'projeto básico', 'projeto basico',
    'análise de risco', 'analise de risco',
    'dfd',

    // Execução contratual
    'alteração contratual', 'alteracao contratual',
    'reajuste',
    'repactuação', 'repactuacao',
    'revisão', 'revisao',
    'prorrogação', 'prorrogacao',
    'acréscimo', 'acrescimo',
    'supressão', 'supressao',

    // Sanções
    'sanção', 'sancao',
    'penalidade',
    'multa',
    'impedimento',
    'declaração de inidoneidade', 'declaracao de inidoneidade',

    // Terceirização
    'terceirização', 'terceirizacao',
    'mão de obra', 'mao de obra',
    'prestação de serviços', 'prestacao de servicos',
    'locação de mão de obra', 'locacao de mao de obra',

    // Inovação
    'tecnologia', 'inovação', 'inovacao',
    'pesquisa', 'desenvolvimento',
    'encomenda tecnológica', 'encomenda tecnologica',

    // Sustentabilidade
    'sustentabilidade',
    'critério de sustentabilidade', 'criterio de sustentabilidade',
    'meio ambiente',
    'acessibilidade',

    // Garantias
    'garantia',
    'caução', 'caucao',
    'seguro-garantia',
    'fiança bancária', 'fianca bancaria',
  ],

  /**
   * Baixa relevância (+2 pontos cada)
   * Termos tangencialmente relacionados
   */
  low: [
    'convênio', 'convenio',
    'parceria',
    'acordo de cooperação', 'acordo de cooperacao',
    'termo de cooperação', 'termo de cooperacao',
    'parceria público-privada', 'ppp',
    'concessão', 'concessao',
    'permissão', 'permissao',
  ],

  /**
   * Exclusão (-15 pontos cada)
   * Assuntos NÃO relacionados a licitações/contratos
   */
  exclude: [
    // Direito penal
    'criminal', 'penal',
    'homicídio', 'homicidio',
    'roubo', 'furto',

    // Direito tributário
    'tributário', 'tributario',
    'imposto', 'tributo',
    'icms', 'ipi', 'pis', 'cofins',
    'crédito tributário', 'credito tributario',

    // Direito previdenciário
    'previdenciário', 'previdenciario',
    'aposentadoria',
    'pensão', 'pensao',
    'benefício previdenciário', 'beneficio previdenciario',

    // Direito trabalhista (pessoal)
    'férias', 'ferias',
    'gratificação', 'gratificacao',
    'adicional',
    'ressarcimento',

    // Outros
    'diária', 'diaria',
    'passagem',
    'viagem',
    'família', 'familia',
    'casamento',
    'divórcio', 'divorcio',
  ],
};

/**
 * Mapeamento de cursos por keywords
 * Usado para sugestão automática de cursos
 */
export const CURSOS_KEYWORDS: Record<string, string[]> = {
  '1': [ // Nova Lei de Licitações (Lei 14.133/2021)
    'lei 14.133', 'lei 14133', 'nova lei',
    'licitação', 'licitacao',
    'pregão', 'pregao',
    'dispensa', 'inexigibilidade',
    'credenciamento',
    'pré-qualificação', 'pre-qualificacao',
    'diálogo competitivo', 'dialogo competitivo',
  ],

  '2': [ // Planejamento das Contratações Públicas
    'planejamento',
    'estudo técnico preliminar', 'etp',
    'termo de referência', 'termo de referencia',
    'projeto básico', 'projeto basico',
    'análise de risco', 'analise de risco',
    'dfd',
    'pesquisa de preços', 'pesquisa de precos',
  ],

  '3': [ // Gestão e Fiscalização de Contratos
    'gestão contratual', 'gestao contratual',
    'fiscalização', 'fiscalizacao',
    'fiscal de contrato',
    'gestor de contrato',
    'acompanhamento contratual',
    'recebimento',
    'execução contratual', 'execucao contratual',
  ],

  '4': [ // Processo Administrativo Sancionador
    'sanção', 'sancao',
    'penalidade',
    'multa',
    'impedimento',
    'declaração de inidoneidade', 'declaracao de inidoneidade',
    'processo administrativo',
    'defesa',
    'recurso',
  ],

  '5': [ // Inovação nas Contratações Públicas
    'inovação', 'inovacao',
    'tecnologia',
    'pesquisa',
    'desenvolvimento',
    'encomenda tecnológica', 'encomenda tecnologica',
    'startup',
    'marco legal da ciência', 'marco legal da ciencia',
  ],

  '6': [ // Terceirização e Formação de Preços
    'terceirização', 'terceirizacao',
    'mão de obra', 'mao de obra',
    'prestação de serviços', 'prestacao de servicos',
    'locação de mão de obra', 'locacao de mao de obra',
    'formação de preços', 'formacao de precos',
    'planilha de custos',
    'bdi',
  ],

  '7': [ // Assessoramento Jurídico
    'assessoramento',
    'consultoria jurídica', 'consultoria juridica',
    'parecer jurídico', 'parecer juridico',
    'procuradoria',
    'advocacia pública', 'advocacia publica',
    'agu',
  ],

  '8': [ // Revisão, Reajuste e Repactuação
    'reajuste',
    'repactuação', 'repactuacao',
    'revisão', 'revisao',
    'equilíbrio econômico-financeiro', 'equilibrio economico-financeiro',
    'álea econômica', 'alea economica',
    'recomposição de preços', 'recomposicao de precos',
  ],

  '9': [ // Alterações Contratuais
    'alteração contratual', 'alteracao contratual',
    'acréscimo', 'acrescimo',
    'supressão', 'supressao',
    'prorrogação', 'prorrogacao',
    'aditivo',
    'modificação contratual', 'modificacao contratual',
  ],

  '10': [ // Contratação Direta
    'dispensa',
    'dispensa eletrônica', 'dispensa eletronica',
    'inexigibilidade',
    'contratação direta', 'contratacao direta',
    'emergência', 'emergencia',
    'calamidade',
    'notória especialização', 'notoria especializacao',
  ],
};

/**
 * Mapeamento de temas por keywords
 * Para categorização e filtros
 */
export const TEMAS_MAP: Record<string, string> = {
  'licitacao': 'Licitação',
  'pregao': 'Pregão Eletrônico',
  'dispensa': 'Dispensa/Inexigibilidade',
  'contrato': 'Contratos Administrativos',
  'lei-14133': 'Lei 14.133/2021',
  'lei-8666': 'Lei 8.666/93',
  'registro-precos': 'Registro de Preços',
  'fiscalizacao': 'Fiscalização Contratual',
  'terceirizacao': 'Terceirização',
  'reajuste': 'Reajuste/Repactuação',
  'planejamento': 'Planejamento',
  'sancao': 'Sanções Administrativas',
  'convenio': 'Convênios',
};

/**
 * Detecta temas baseado em keywords encontradas
 */
export function detectTemas(text: string): string[] {
  const textLower = text.toLowerCase();
  const temas: string[] = [];

  // Licitação
  if (textLower.includes('licitação') || textLower.includes('licitacao')) {
    temas.push(TEMAS_MAP['licitacao']);
  }

  // Pregão
  if (textLower.includes('pregão') || textLower.includes('pregao')) {
    temas.push(TEMAS_MAP['pregao']);
  }

  // Dispensa/Inexigibilidade
  if (textLower.includes('dispensa') || textLower.includes('inexigibilidade')) {
    temas.push(TEMAS_MAP['dispensa']);
  }

  // Contratos
  if (textLower.includes('contrato') || textLower.includes('contratação') || textLower.includes('contratacao')) {
    temas.push(TEMAS_MAP['contrato']);
  }

  // Lei 14.133
  if (textLower.includes('lei 14.133') || textLower.includes('lei 14133')) {
    temas.push(TEMAS_MAP['lei-14133']);
  }

  // Lei 8.666
  if (textLower.includes('lei 8.666') || textLower.includes('lei 8666')) {
    temas.push(TEMAS_MAP['lei-8666']);
  }

  // Registro de Preços
  if (textLower.includes('registro de preços') || textLower.includes('registro de precos')) {
    temas.push(TEMAS_MAP['registro-precos']);
  }

  // Fiscalização
  if (textLower.includes('fiscalização') || textLower.includes('fiscalizacao')) {
    temas.push(TEMAS_MAP['fiscalizacao']);
  }

  // Terceirização
  if (textLower.includes('terceirização') || textLower.includes('terceirizacao')) {
    temas.push(TEMAS_MAP['terceirizacao']);
  }

  // Reajuste
  if (textLower.includes('reajuste') || textLower.includes('repactuação') || textLower.includes('repactuacao')) {
    temas.push(TEMAS_MAP['reajuste']);
  }

  // Planejamento
  if (textLower.includes('planejamento')) {
    temas.push(TEMAS_MAP['planejamento']);
  }

  // Sanções
  if (textLower.includes('sanção') || textLower.includes('sancao') || textLower.includes('penalidade')) {
    temas.push(TEMAS_MAP['sancao']);
  }

  // Convênios
  if (textLower.includes('convênio') || textLower.includes('convenio')) {
    temas.push(TEMAS_MAP['convenio']);
  }

  return temas;
}
