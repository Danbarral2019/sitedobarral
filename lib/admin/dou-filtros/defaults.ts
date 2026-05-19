/**
 * Constantes e defaults pro DOU Filtros admin.
 */

import { DateRangePreset } from '@/lib/dou-classifier';

export interface DOUFilterConfig {
  searchTerm: string;
  sections: string[];
  datePreset: DateRangePreset | 'custom';
  dateFrom: string;
  dateTo: string;
  minConfidence: number;
  includeKeywords: string;
  excludeKeywords: string;
  maxResults: number;
}

export const DEFAULT_DOU_FILTERS: DOUFilterConfig = {
  searchTerm: 'licitação OR pregão',
  sections: [],
  datePreset: DateRangePreset.ULTIMA_SEMANA,
  dateFrom: '',
  dateTo: '',
  minConfidence: 0,
  includeKeywords: '',
  excludeKeywords: '',
  maxResults: 50,
};

export const DOU_SECTIONS = [
  { value: 'do1', label: 'Seção 1 - Leis e Decretos' },
  { value: 'do2', label: 'Seção 2 - Atos de Pessoal' },
  { value: 'do3', label: 'Seção 3 - Contratos e Licitações' },
  { value: 'doe', label: 'Edições Extra' },
] as const;

export const DOU_DATE_PRESETS = [
  { value: DateRangePreset.HOJE, label: 'Hoje' },
  { value: DateRangePreset.ONTEM, label: 'Ontem' },
  { value: DateRangePreset.ULTIMA_SEMANA, label: 'Última semana' },
  { value: DateRangePreset.ULTIMO_MES, label: 'Último mês' },
  { value: DateRangePreset.ULTIMOS_3_MESES, label: 'Últimos 3 meses' },
  { value: 'custom', label: 'Personalizado' },
] as const;

/**
 * Filtra estado de selecao da lista visivel.
 * Util pra logica de "Selecionar todos" quando ha multiplas listas.
 */
export function computeIsAllSelected<T extends { id: string }>(items: T[], selectedIds: Set<string>): boolean {
  return items.length > 0 && items.every((item) => selectedIds.has(item.id));
}
