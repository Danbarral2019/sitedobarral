import { Info } from 'lucide-react';
import { HIERARCHY_LEVELS, HIERARCHY_LEVEL_ORDER } from '@/lib/legislative-acts/hierarchy';

/**
 * Legenda visual da hierarquia normativa — pirâmide compacta sempre visível,
 * sem explicação adicional. Só serve pra dar contexto rápido das cores
 * que aparecem nos badges de tipo dos cards.
 *
 * Padrão usado nos badges em toda a app:
 *   Lei (h=1) vermelho · Decreto (h=2) azul · Portaria (h=3) verde
 *   IN/Resolução (h=4) roxo · OS (h=5) amarelo
 */

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-800 border-red-300',
  2: 'bg-brand-100 text-brand-800 border-brand-300',
  3: 'bg-green-100 text-green-800 border-green-300',
  4: 'bg-brand-100 text-brand-800 border-brand-300',
  5: 'bg-amber-accent-soft text-amber-accent-deep border-amber-accent',
};

/** Label compacto pra pirâmide (override do label "completo" em HIERARCHY_LEVELS). */
const COMPACT_LABEL: Record<number, string> = {
  1: 'Lei',
  2: 'Decreto',
  3: 'Portaria',
  4: 'IN · Resolução',
  5: 'OS',
};

export function HierarchyLegend() {
  return (
    <div className="bg-white border-2 border-border-subtle rounded-[6px] px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Info className="w-4 h-4 text-brand-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-ink-primary">Hierarquia normativa</span>
        <span className="flex items-center gap-1.5 ml-2 flex-wrap">
          {HIERARCHY_LEVEL_ORDER.map((level, i) => (
            <span key={level} className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 text-xs font-bold rounded border ${LEVEL_COLORS[level]}`}>
                {COMPACT_LABEL[level] ?? HIERARCHY_LEVELS[level].label}
              </span>
              {i < HIERARCHY_LEVEL_ORDER.length - 1 && (
                <span className="text-ink-muted text-xs" aria-hidden="true">›</span>
              )}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
