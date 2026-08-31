/**
 * Labels e cores dos tipos de atos legislativos + helpers de formatacao.
 */

export const TYPE_LABELS: Record<string, string> = {
  decreto: 'Decreto',
  portaria: 'Portaria',
  in: 'IN',
  'ordem-servico': 'Ordem de Serviço',
  lei: 'Lei',
  'medida-provisoria': 'Medida Provisória',
  resolucao: 'Resolução',
  boa_pratica: 'Outro Ato Normativo',
  orientacao_procedimento: 'Orientação',
};

export const TYPE_COLORS: Record<string, string> = {
  decreto: 'bg-brand-100 text-brand-800 border-brand-300',
  portaria: 'bg-green-100 text-green-800 border-green-300',
  in: 'bg-brand-100 text-brand-800 border-brand-300',
  'ordem-servico': 'bg-amber-accent-soft text-amber-accent-deep border-amber-accent',
  lei: 'bg-red-100 text-red-800 border-red-300',
  'medida-provisoria': 'bg-amber-accent-soft text-amber-accent-deep border-amber-accent',
  resolucao: 'bg-rose-100 text-rose-800 border-rose-300',
  boa_pratica: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  orientacao_procedimento: 'bg-amber-accent-soft text-amber-accent-deep border-amber-accent',
};

export const ESFERA_LABELS: Record<string, string> = {
  federal: 'Federal',
  estadual: 'Estadual',
};

export const VALID_SORT_VALUES = new Set(['recent', 'oldest', 'hierarchy', 'number', 'alpha']);

export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || 'bg-surface-deep text-ink-secondary border-border-subtle';
}

export function getEsferaLabel(esfera: string): string {
  return ESFERA_LABELS[esfera] || esfera;
}

export function formatLegislativeDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function isValidSort(value: string | null | undefined): boolean {
  return typeof value === 'string' && VALID_SORT_VALUES.has(value);
}
