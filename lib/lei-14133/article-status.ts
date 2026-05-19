/**
 * Classifica artigos da Lei 14.133 conforme quantidade de documentos relacionados.
 *
 * Niveis (5):
 *   0       -> Sem documentos (cinza)
 *   1-2     -> Inicial (laranja, trending up)
 *   3-5     -> Medio (azul, target)
 *   6-14    -> Bom (verde, check)
 *   >=15    -> Excelente (esmeralda, check)
 */

import { AlertCircle, TrendingUp, Target, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ArticleStatusInfo {
  label: string;
  color: string;
  icon: LucideIcon;
}

export function getArticleStatus(count: number): ArticleStatusInfo {
  if (count === 0) return { label: 'Sem documentos', color: 'bg-gray-100 text-gray-600', icon: AlertCircle };
  if (count < 3) return { label: 'Inicial', color: 'bg-orange-100 text-orange-700', icon: TrendingUp };
  if (count < 6) return { label: 'Médio', color: 'bg-blue-100 text-blue-700', icon: Target };
  if (count < 15) return { label: 'Bom', color: 'bg-green-100 text-green-700', icon: CheckCircle };
  return { label: 'Excelente', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle };
}
