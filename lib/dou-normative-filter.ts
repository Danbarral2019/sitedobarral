/**
 * Filtro Inteligente de Atos Normativos do DOU
 *
 * Distingue atos normativos gerais (decretos, portarias normativas, INs)
 * de atos concretos (designações, extratos de contrato, etc.)
 *
 * Lógica:
 * 1. Filtro negativo: rejeita atos concretos (designar, nomear, extrato, etc.)
 * 2. Filtro positivo: identifica atos normativos gerais (regulamenta, dispõe sobre, etc.)
 * 3. Auto-aprovação por autoridade: Presidência (decretos) e MGI/SEGES (portarias, INs, ONs)
 */

/**
 * Padrões que indicam atos concretos (devem ser rejeitados)
 */
const CONCRETE_ACT_PATTERNS = [
  // Atos de pessoal
  'designar', 'nomear', 'exonerar', 'dispensar servidor', 'substituir',
  'delegar competência', 'delegar competencia',
  'conceder pensão', 'conceder aposentadoria', 'pensão civil',
  'aposentar', 'dispensar a pedido',
  'autorizar o afastamento', 'licença para tratar',

  // Atos de gestão concreta
  'fiscal de contrato', 'gestor de contrato', 'pregoeiro',
  'autorizar a abertura', 'homologar o resultado',
  'adjudicar o objeto', 'ratificar a dispensa', 'ratificar a inexigibilidade',

  // Identificadores de atos individuais
  'processo nº', 'processo n°', 'uasg',
  'cnpj', 'cpf nº',
  'matrícula siape', 'matricula siape',
  'empresa:', 'contratada:', 'contratante:',
  'valor global:', 'valor total:', 'valor mensal:',
  'extrato de', 'aviso de', 'resultado de julgamento',

  // Editais e avisos de licitação (títulos)
  'edital complementar', 'edital progesp', 'edital progepe',
  'edital de convocação', 'edital de seleção', 'edital de chamamento',
  'edital de credenciamento', 'edital de concurso',
  'avisos de licitação', 'aviso de licitação', 'aviso de dispensa',
  'aviso de inexigibilidade',
  'extrato prévio', 'extrato de doação', 'extrato de contrato',
  'extrato de termo', 'extrato de aditivo',

  // Atos administrativos concretos (título)
  'acordo de cooperação', 'termo de cooperação',
  'ata de registro de preço', 'registro de preço',
];

/**
 * Regex de título que indicam ato concreto (prioridade sobre classificação)
 */
const CONCRETE_TITLE_PATTERNS = [
  /^edital\b/i,
  /^aviso\b/i,
  /^extratos?\b/i,
  /^retifica[çc][ãa]o\b/i,
  /^despacho\b/i,
  /^ata\s+n[ºo°]/i,
  /^autoriza[çc][ãa]o\b/i,
  /^portarias\s+de\s+\d/i,
  /^ato\s+declarat[óo]rio/i,
  /^alvar[áa]\b/i,
  /^adendo\b/i,
  /^aditamento\b/i,
  /^decis[ãa]o\s+de\b/i,
];

/**
 * Padrões que indicam atos normativos gerais (devem ser aceitos)
 */
const GENERAL_ACT_INDICATORS = [
  'regulamenta', 'regulamentar', 'regulamentação',
  'dispõe sobre', 'dispoe sobre',
  'estabelece procedimentos', 'estabelece normas', 'estabelece diretrizes',
  'aprova o regulamento', 'aprova regulamento',
  'altera o decreto', 'altera a portaria', 'altera a lei',
  'altera a instrução normativa', 'altera a resolução',
  'institui', 'instituir',
  'disciplina', 'disciplinar',
  'define critérios', 'define procedimentos',
  'normas gerais', 'regras gerais',
  'no âmbito da administração pública federal',
  'órgãos e entidades da administração',
];

/**
 * Autoridades cujos atos normativos são auto-aprovados
 */
const AUTO_APPROVE_AUTHORITIES: Array<{
  patterns: string[];
  types: string[];
}> = [
  {
    patterns: ['presidência da república', 'presidente da república'],
    types: ['decreto'],
  },
  {
    patterns: [
      'secretário de gestão e inovação', 'secretaria de gestão e inovação',
      'seges', 'ministério da gestão e da inovação', 'mgi',
    ],
    types: ['portaria', 'instrução normativa', 'instrucao normativa', 'orientação normativa'],
  },
];

export type NormativeClassification = 'geral' | 'concreto' | 'ambiguo';

export type AtoType = 'decreto' | 'portaria' | 'in' | 'on' | 'lei' | 'mp' | null;

/**
 * Classifica se um ato é normativo geral, concreto ou ambíguo
 */
export function isAtoNormativoGeral(title: string, abstract: string): NormativeClassification {
  const text = `${title} ${abstract}`.toLowerCase();
  const titleTrimmed = title.replace(/<[^>]*>/g, '').trim();

  // Verificar título concreto primeiro (editais, avisos, extratos)
  if (CONCRETE_TITLE_PATTERNS.some(p => p.test(titleTrimmed))) {
    return 'concreto';
  }

  // Verificar filtro negativo (atos concretos no texto)
  const hasConcrete = CONCRETE_ACT_PATTERNS.some(p => text.includes(p));
  const hasGeneral = GENERAL_ACT_INDICATORS.some(p => text.includes(p));

  if (hasConcrete && !hasGeneral) return 'concreto';
  if (hasGeneral && !hasConcrete) return 'geral';
  if (hasGeneral && hasConcrete) return 'ambiguo';

  // Sem indicadores claros: verificar tipo do ato pelo título
  const atoType = detectAtoType(title);
  if (atoType === 'decreto' || atoType === 'lei' || atoType === 'mp') return 'geral';
  if (atoType === 'in' || atoType === 'on') return 'geral';

  return 'ambiguo';
}

/**
 * Verifica se deve auto-aprovar baseado em autoridade e tipo
 */
export function shouldAutoApprove(
  title: string,
  hierarchyStr: string,
  detectedType: AtoType
): boolean {
  if (!detectedType) return false;

  const hierarchy = hierarchyStr.toLowerCase();
  const titleLower = title.toLowerCase();

  for (const authority of AUTO_APPROVE_AUTHORITIES) {
    const matchesAuthority = authority.patterns.some(
      p => hierarchy.includes(p) || titleLower.includes(p)
    );
    if (!matchesAuthority) continue;

    const matchesType = authority.types.some(t => {
      if (t === 'instrução normativa' || t === 'instrucao normativa') {
        return detectedType === 'in';
      }
      if (t === 'orientação normativa') {
        return detectedType === 'on';
      }
      return detectedType === t;
    });

    if (matchesType) return true;
  }

  return false;
}

/**
 * Keywords de licitações/contratações para filtro de relevância temática.
 * Usadas para verificar se um ato regulamenta diretamente a Lei 14.133.
 * Verificação apenas no TÍTULO — o abstract/ementa é muito permissivo
 * (milhares de atos citam "lei 14.133" no texto sem regulamentá-la).
 */
const PROCUREMENT_KEYWORDS = [
  'licitação', 'licitações', 'licitar', 'licitatório', 'licitatória',
  'contratação', 'contratações', 'contratar',
  'pregão', 'pregões', 'pregão eletrônico',
  'dispensa de licitação', 'inexigibilidade',
  'registro de preços', 'ata de registro',
  'lei 14.133', 'lei nº 14.133', 'lei 14133', '14.133/2021',
  'sanção administrativa', 'processo sancionador', 'sanções administrativas',
  'planejamento da contratação', 'fase preparatória',
  'gestão de contratos', 'fiscalização de contratos',
  'compras públicas', 'compras governamentais',
  'seges', // Secretaria de Gestão — órgão central de compras
];

/**
 * Órgãos cujos atos normativos são automaticamente considerados
 * relacionados a licitações/contratações (independente de keywords no título).
 */
const PROCUREMENT_ORGANS = [
  'seges', 'secretaria de gestão',
  'mgi', 'ministério da gestão',
  'mpo', 'ministério do planejamento',
  'agu', 'advocacia-geral da união',
];

/**
 * Verifica se o ato é relacionado a licitações/contratações.
 *
 * Busca keywords no título E no abstract (ementa), além de auto-aprovar
 * atos de órgãos centrais de compras (SEGES, MGI, MPO, AGU).
 *
 * O abstract é incluído porque portarias normativas frequentemente têm
 * títulos genéricos ("PORTARIA Nº 443") mas a ementa descreve o tema.
 */
export function isProcurementRelated(title: string, abstract?: string, hierarchyStr?: string): boolean {
  const titleLower = title.toLowerCase();
  const abstractLower = (abstract || '').toLowerCase();
  const text = `${titleLower} ${abstractLower}`;

  // Verificar keywords no título + abstract
  if (PROCUREMENT_KEYWORDS.some(k => text.includes(k))) {
    return true;
  }

  // Auto-aprovar se órgão emissor é relevante para compras públicas
  if (hierarchyStr) {
    const hierarchyLower = hierarchyStr.toLowerCase();
    if (PROCUREMENT_ORGANS.some(o => hierarchyLower.includes(o))) {
      return true;
    }
  }

  return false;
}

/**
 * Detecta o tipo de ato normativo pelo título
 */
export function detectAtoType(title: string): AtoType {
  const t = title.toLowerCase();

  if (/\bdecreto\b/.test(t)) return 'decreto';
  if (/\blei\s+(?:n[ºo°]?|federal|complementar)/.test(t)) return 'lei';
  if (/\bmedida\s+provis[oó]ria\b/.test(t)) return 'mp';
  if (/\binstrução\s+normativa\b/.test(t) || /\binstrucao\s+normativa\b/.test(t) || /\bin\s+(?:seges|mgi|n[ºo°]?)/.test(t)) return 'in';
  if (/\borientação\s+normativa\b/.test(t) || /\borientacao\s+normativa\b/.test(t) || /\bon\s+(?:agu|n[ºo°]?)/.test(t)) return 'on';
  if (/\bportaria\b/.test(t)) return 'portaria';

  return null;
}
