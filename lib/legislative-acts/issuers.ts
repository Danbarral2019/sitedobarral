/**
 * Lista canônica de órgãos emissores de atos legislativos no acervo.
 *
 * REGRA: o campo `LegislativeAct.issuer` aceita APENAS valores desta lista.
 * Qualquer valor fora dela é normalizado pra forma canônica via
 * `normalizeIssuer()` ou rejeitado por `assertCanonicalIssuer()`.
 *
 * Importante: NÃO adicionar issuer novo sem confirmação explícita do
 * mantenedor — em ~99% dos casos um issuer "novo" é variação de nome
 * (ex: SEGES/MP, SESGES, ME) do mesmo órgão real.
 */

/** Lista canônica — ordem segue a relevância editorial (Presidência primeiro). */
export const CANONICAL_ISSUERS = [
  'Presidência da República',
  'SEGES', // Secretaria de Gestão (atual MGI, antes ME, antes MPOG)
  'MPOG', // Ministério do Planejamento, Orçamento e Gestão (antigo — INs históricas pre-2018)
  'SGD/MGI', // Secretaria de Governo Digital
  'TCU', // Tribunal de Contas da União
  'MPU', // Ministério Público da União
  'CICS/MGI', // Comissão Inter-secretarial de Compras e Serviços
  'CIIA-PAC/CC', // Comissão Interministerial de Integração e Acompanhamento — PAC/Casa Civil
] as const;

export type CanonicalIssuer = (typeof CANONICAL_ISSUERS)[number];

/**
 * Mapa de variações comuns → forma canônica.
 *
 * Cobre erros históricos de scrape (SESGES, SEGES/MP, etc.), nomes
 * antigos do órgão (ME → SEGES, MP → MPOG, AUTOR/ME → SEGES) e variações
 * de capitalização.
 */
const ISSUER_ALIASES: Record<string, CanonicalIssuer> = {
  // Presidência da República
  'Presidência': 'Presidência da República',
  'Presidencia': 'Presidência da República',
  'Presidência da República': 'Presidência da República',
  'Presidencia da Republica': 'Presidência da República',
  'PR': 'Presidência da República',

  // SEGES (Secretaria de Gestão — atual MGI, antes ME)
  'SEGES': 'SEGES',
  'SEGES/MGI': 'SEGES',
  'SEGES/ME': 'SEGES',
  'SEGES/MP': 'SEGES',
  'SESGES': 'SEGES', // typo histórico
  'AUTOR/ME': 'SEGES', // erro de scrape — autoria SEGES dentro do ME
  'ME': 'SEGES', // Ministério da Economia → SEGES era a sub-secretaria

  // MPOG — Ministério do Planejamento (antigo, pre-2018) — preserva
  // distinção histórica das INs SEGES atuais.
  'MP': 'MPOG',
  'MPO': 'MPOG',
  'MPOG': 'MPOG',
  'Ministério do Planejamento': 'MPOG',

  // Demais órgãos — passam direto (não consolidam com nada)
  'SGD/MGI': 'SGD/MGI',
  'SGD': 'SGD/MGI',
  'TCU': 'TCU',
  'MPU': 'MPU',
  'CICS/MGI': 'CICS/MGI',
  'CIIA-PAC/CC': 'CIIA-PAC/CC',
};

/**
 * Normaliza um issuer (raw do scrape ou JSON) pra forma canônica.
 *
 * Lança `Error` se o valor não casa com nenhum alias conhecido — força
 * o desenvolvedor a decidir conscientemente (perguntando ao mantenedor)
 * antes de criar issuer novo.
 *
 * @example
 *   normalizeIssuer('SEGES/MGI')      → 'SEGES'
 *   normalizeIssuer('Presidência')    → 'Presidência da República'
 *   normalizeIssuer('MP')             → 'MPOG'
 *   normalizeIssuer('Foo Bar')        → throws Error
 */
export function normalizeIssuer(raw: string): CanonicalIssuer {
  const trimmed = (raw ?? '').trim();
  const direct = ISSUER_ALIASES[trimmed];
  if (direct) return direct;

  // Fallback: case-insensitive lookup
  const lookup = Object.entries(ISSUER_ALIASES).find(
    ([key]) => key.toLowerCase() === trimmed.toLowerCase(),
  );
  if (lookup) return lookup[1];

  throw new Error(
    `Issuer desconhecido: "${raw}". Adicione em ISSUER_ALIASES (lib/legislative-acts/issuers.ts) ` +
      `apontando pra um dos canônicos: ${CANONICAL_ISSUERS.join(', ')}. ` +
      `Em geral, "novo" issuer é variação de nome de um já existente — confirme com o mantenedor.`,
  );
}

/**
 * Verifica se um valor é canônico (sem normalizar). Útil em validação
 * de input vinda de outro serviço.
 */
export function isCanonicalIssuer(value: string): value is CanonicalIssuer {
  return (CANONICAL_ISSUERS as readonly string[]).includes(value);
}

/**
 * Valida que o issuer é canônico — lança erro caso contrário. Usar em
 * pontos críticos do pipeline onde NÃO queremos auto-normalização
 * silenciosa (ex: validação de schema antes de gravar).
 */
export function assertCanonicalIssuer(value: string): asserts value is CanonicalIssuer {
  if (!isCanonicalIssuer(value)) {
    throw new Error(
      `Issuer "${value}" não é canônico. Use normalizeIssuer() ou um valor de CANONICAL_ISSUERS.`,
    );
  }
}
