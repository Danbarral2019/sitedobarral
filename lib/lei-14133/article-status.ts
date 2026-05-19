/**
 * Classifica artigos da Lei 14.133 conforme quantidade de documentos relacionados.
 *
 * Duas variantes de label:
 *   - 'reader'    (default): "Sem documentos" / "Inicial" / "Medio" / "Bom" / "Excelente"
 *                            count 0 = cinza (artigo sem regulamentacao ainda)
 *   - 'editorial': "Orfao" / "Escasso" / "Medio" / "Bom" / "Excelente"
 *                  count 0 = vermelho (sinal de alerta editorial)
 *
 * A variante 'editorial' e usada na area-restrita/lei-comentada, onde labels
 * sao mais opinativos (orfao = falta cobertura).
 */

import { AlertCircle, TrendingUp, Target, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ArticleStatusVariant = 'reader' | 'editorial';

export interface ArticleStatusInfo {
  label: string;
  color: string;
  icon: LucideIcon;
}

export function getArticleStatus(count: number, variant: ArticleStatusVariant = 'reader'): ArticleStatusInfo {
  if (count === 0) {
    return variant === 'editorial'
      ? { label: 'Órfão', color: 'bg-red-100 text-red-700', icon: AlertCircle }
      : { label: 'Sem documentos', color: 'bg-gray-100 text-gray-600', icon: AlertCircle };
  }
  if (count < 3) {
    return variant === 'editorial'
      ? { label: 'Escasso', color: 'bg-orange-100 text-orange-700', icon: TrendingUp }
      : { label: 'Inicial', color: 'bg-orange-100 text-orange-700', icon: TrendingUp };
  }
  if (count < 6) return { label: 'Médio', color: 'bg-blue-100 text-blue-700', icon: Target };
  if (count < 15) return { label: 'Bom', color: 'bg-green-100 text-green-700', icon: CheckCircle };
  return { label: 'Excelente', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle };
}
