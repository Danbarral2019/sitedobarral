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

  // Atos de gestão concreta
  'fiscal de contrato', 'gestor de contrato', 'pregoeiro',
  'autorizar a abertura', 'homologar o resultado',
  'adjudicar o objeto', 'ratificar a dispensa', 'ratificar a inexigibilidade',

  // Identificadores de atos individuais
  'processo nº', 'processo n°', 'uasg',
  'cnpj', 'cpf nº',
  'empresa:', 'contratada:', 'contratante:',
  'valor global:', 'valor total:', 'valor mensal:',
  'extrato de', 'aviso de', 'resultado de julgamento',
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

  // Verificar filtro negativo primeiro (atos concretos)
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
