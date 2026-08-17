/**
 * Funcoes puras de formatacao usadas no admin de tribunal-decisions.
 *
 * Mantidas separadas dos componentes pra serem testaveis sem JSDOM.
 */

export function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}min atras`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h atras`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d atras`;
  return date.toLocaleDateString('pt-BR');
}

const TRIBUNAL_COLORS: Record<string, string> = {
  'TCE-SP': 'bg-blue-100 text-blue-800',
  'TCE-MG': 'bg-green-100 text-green-800',
  'TCE-PR': 'bg-purple-100 text-purple-800',
  'TCE-SC': 'bg-sky-100 text-sky-800',
  'TCE-RJ': 'bg-orange-100 text-orange-800',
  'TCE-RS': 'bg-violet-100 text-violet-800',
  'TCE-PE': 'bg-teal-100 text-teal-800',
  TCU: 'bg-red-100 text-red-800',
  'DATAJUD-STJ': 'bg-red-100 text-red-800',
  TST: 'bg-rose-100 text-rose-800',
  STF: 'bg-amber-100 text-amber-900',
};

export function tribunalColor(tribunal: string): string {
  return TRIBUNAL_COLORS[tribunal] || 'bg-gray-100 text-gray-800';
}

export function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getRelevanceColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 50) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

export function getApprovalStatusColor(status: string): string {
  if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
  if (status.includes('approved')) return 'bg-green-100 text-green-800';
  return 'bg-red-100 text-red-800';
}

export type HealthBadgeKind = 'ok' | 'warning' | 'error';

export interface HealthBadgeInfo {
  label: HealthBadgeKind;
  color: string;
}

export function getHealthBadgeKind(isHealthy: boolean, consecutiveFailures: number): HealthBadgeInfo {
  if (isHealthy && consecutiveFailures === 0) {
    return { label: 'ok', color: 'bg-green-50 border-green-200' };
  }
  if (isHealthy) {
    return { label: 'warning', color: 'bg-yellow-50 border-yellow-200' };
  }
  return { label: 'error', color: 'bg-red-50 border-red-200' };
}
