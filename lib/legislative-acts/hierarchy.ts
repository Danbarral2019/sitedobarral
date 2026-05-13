/**
 * Fonte canônica da hierarquia normativa.
 *
 * Antes desta consolidação, o mapeamento type → hierarchyLevel estava duplicado
 * em ~6 lugares (cron sync-dou, clipping-dou approve, scripts audit/fix/validate,
 * admin endpoints) com divergências:
 *   - admin/legislative-acts (POST e import) tinham `medida-provisoria: 2` (errado;
 *     MP tem força de lei, deveria ser 1). Corrigido aqui.
 *   - cron sync-dou usa abreviações `mp` e `on`; admin usa `medida-provisoria`
 *     e `ordem-servico`. Os aliases agora estão no mesmo objeto.
 *
 * Níveis (menor número = hierarquia mais alta):
 *   1 = Lei (incl. Lei Ordinária, Lei Complementar, Medida Provisória)
 *   2 = Decreto (incl. Decreto-Lei)
 *   3 = Portaria
 *   4 = IN / Resolução
 *   5 = Ordem de Serviço
 */

/** Tipos canônicos do schema LegislativeAct.type. */
export type ActType =
  | 'lei'
  | 'lei-complementar'
  | 'medida-provisoria'
  | 'decreto'
  | 'decreto-lei'
  | 'portaria'
  | 'in'
  | 'instrucao-normativa'
  | 'resolucao'
  | 'ordem-servico';

/**
 * Mapeamento type → nível hierárquico. Inclui aliases curtos usados pelo cron
 * DOU (`mp`, `on`) pra permitir lookup direto sem normalização prévia.
 */
const HIERARCHY_BY_TYPE: Record<string, number> = {
  // Nível 1 — força de lei
  lei: 1,
  'lei-complementar': 1,
  'medida-provisoria': 1,
  mp: 1,
  // Nível 2 — decreto
  decreto: 2,
  'decreto-lei': 2,
  // Nível 3 — portaria
  portaria: 3,
  // Nível 4 — IN / Resolução
  in: 4,
  'instrucao-normativa': 4,
  resolucao: 4,
  // Nível 5 — Ordem de Serviço (alias `on` usado por cron DOU)
  'ordem-servico': 5,
  on: 5,
};

/** Tipos não-canônicos do model (usado por fallback em /legislacao/[id]). */
export type NonLegislativeActType = 'boa_pratica' | 'orientacao_procedimento';

/** Tipo que carrega hierarchyLevel — `null` indica "não aplicável" (boa_pratica etc.). */
export type HierarchyLevel = 1 | 2 | 3 | 4 | 5 | null;

/**
 * Retorna o nível hierárquico para um type. Aceita aliases (`mp`, `on`).
 * Retorna `fallback` (default 5) se type não for reconhecido.
 *
 * Use `getHierarchyLevelOrNull` para preservar null em fallback (útil em UI
 * que pinta "atos sem nível" separadamente).
 */
export function getHierarchyLevel(type: string, fallback: number = 5): number {
  return HIERARCHY_BY_TYPE[type] ?? fallback;
}

/** Variante que retorna null para types não reconhecidos. */
export function getHierarchyLevelOrNull(type: string): number | null {
  return HIERARCHY_BY_TYPE[type] ?? null;
}

/** Metadados visuais por nível hierárquico — usado em UI (legenda, badges, headers). */
export interface HierarchyInfo {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  pluralLabel: string;
  emoji: string;
  description: string;
}

export const HIERARCHY_LEVELS: Record<1 | 2 | 3 | 4 | 5, HierarchyInfo> = {
  1: {
    level: 1,
    label: 'Lei',
    pluralLabel: 'Leis',
    emoji: '📜',
    description: 'norma de hierarquia máxima',
  },
  2: {
    level: 2,
    label: 'Decreto',
    pluralLabel: 'Decretos',
    emoji: '📋',
    description: 'regulamenta lei',
  },
  3: {
    level: 3,
    label: 'Portaria',
    pluralLabel: 'Portarias',
    emoji: '📑',
    description: 'ato de Ministro ou autoridade equivalente',
  },
  4: {
    level: 4,
    label: 'IN / Resolução',
    pluralLabel: 'Instruções Normativas e Resoluções',
    emoji: '📝',
    description: 'detalha portaria ou decreto',
  },
  5: {
    level: 5,
    label: 'Ordem de Serviço',
    pluralLabel: 'Ordens de Serviço',
    emoji: '📌',
    description: 'ato interno operacional',
  },
};

/** Helper: retorna info do nível ou null se fora da faixa. */
export function getHierarchyInfo(level: number | null | undefined): HierarchyInfo | null {
  if (level == null) return null;
  if (level < 1 || level > 5) return null;
  return HIERARCHY_LEVELS[level as 1 | 2 | 3 | 4 | 5];
}

/** Label curto para descrições. */
export function getHierarchyLabel(level: number | null | undefined): string {
  return getHierarchyInfo(level)?.label ?? `nivel-${level}`;
}

/** Lista ordenada dos níveis — útil pra iterar na legenda. */
export const HIERARCHY_LEVEL_ORDER: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
