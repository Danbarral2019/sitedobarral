/**
 * Cores e nomes longos por tribunal para uso no template HTML do
 * Clipping Diário multi-tribunal.
 *
 * Contraste AA mínimo contra branco (#ffffff) garantido em todas as cores.
 */
export interface TribunalBrand {
  code: string;
  fullName: string;
  /** Background do badge/cabeçalho do tribunal (deve passar contraste AA com branco). */
  color: string;
}

const BRANDS: Record<string, TribunalBrand> = {
  TCU: { code: 'TCU', fullName: 'Tribunal de Contas da União', color: '#1e3a8a' },
  'TCE-PE': { code: 'TCE-PE', fullName: 'Tribunal de Contas do Estado de Pernambuco', color: '#059669' },
  'TCE-RS': { code: 'TCE-RS', fullName: 'Tribunal de Contas do Estado do Rio Grande do Sul', color: '#b45309' },
  'TCE-SP': { code: 'TCE-SP', fullName: 'Tribunal de Contas do Estado de São Paulo', color: '#991b1b' },
  'TCE-PR': { code: 'TCE-PR', fullName: 'Tribunal de Contas do Estado do Paraná', color: '#6d28d9' },
  'TCE-SC': { code: 'TCE-SC', fullName: 'Tribunal de Contas do Estado de Santa Catarina', color: '#0f766e' },
  'TCE-RJ': { code: 'TCE-RJ', fullName: 'Tribunal de Contas do Estado do Rio de Janeiro', color: '#1d4ed8' },
  'TCE-MG': { code: 'TCE-MG', fullName: 'Tribunal de Contas do Estado de Minas Gerais', color: '#a16207' },
  STJ: { code: 'STJ', fullName: 'Superior Tribunal de Justiça', color: '#374151' },
  STF: { code: 'STF', fullName: 'Supremo Tribunal Federal', color: '#7c2d12' },
};

const FALLBACK: TribunalBrand = {
  code: 'TRIBUNAL',
  fullName: 'Tribunal',
  color: '#475569',
};

export function getTribunalBrand(code: string): TribunalBrand {
  return BRANDS[code] || { ...FALLBACK, code, fullName: code };
}
