'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { HIERARCHY_LEVELS, HIERARCHY_LEVEL_ORDER } from '@/lib/legislative-acts/hierarchy';

/**
 * Legenda visual da hierarquia normativa.
 *
 * Padrão usado nos badges de tipo em toda a app:
 *   Lei (h=1) vermelho · Decreto (h=2) azul · Portaria (h=3) verde
 *   IN (h=4) roxo · OS (h=5) amarelo
 *
 * Mostra a pirâmide compacta por default; expandida traz descrição completa
 * de cada nível.
 */

/** Cor de cada nível (espelha TYPE_COLORS dos badges de tipo). */
const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-800 border-red-300',
  2: 'bg-blue-100 text-blue-800 border-blue-300',
  3: 'bg-green-100 text-green-800 border-green-300',
  4: 'bg-purple-100 text-purple-800 border-purple-300',
  5: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

/** Descrições completas (vs description curta em HIERARCHY_LEVELS). */
const LEVEL_LONG_DESCRIPTIONS: Record<number, string> = {
  1: 'Norma de hierarquia máxima. Inclui Lei Ordinária, Lei Complementar e Medida Provisória (que tem força de lei até conversão).',
  2: 'Regulamenta lei. Editado pelo chefe do Executivo (Presidente, Governador, Prefeito).',
  3: 'Ato de Ministro ou autoridade equivalente. Não pode contrariar lei nem decreto.',
  4: 'Instrução Normativa ou Resolução, geralmente de Secretaria ou órgão técnico. Detalha portaria/decreto.',
  5: 'Ordem de Serviço. Ato interno operacional, menor amplitude.',
};

const LEVELS = HIERARCHY_LEVEL_ORDER.map((level) => ({
  level,
  // Label compacto pra pirâmide (sobrescreve plural de HIERARCHY_LEVELS quando útil)
  label: level === 4 ? 'IN · Resolução' : level === 5 ? 'OS' : HIERARCHY_LEVELS[level].label,
  color: LEVEL_COLORS[level],
  description: LEVEL_LONG_DESCRIPTIONS[level],
}));

export function HierarchyLegend() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        aria-expanded={expanded}
        aria-controls="hierarchy-legend-body"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900">Hierarquia normativa</span>
          {/* Pirâmide compacta sempre visível */}
          <span className="flex items-center gap-1.5 ml-2 flex-wrap">
            {LEVELS.map((l, i) => (
              <span key={l.level} className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 text-xs font-bold rounded border ${l.color}`}>
                  {l.label}
                </span>
                {i < LEVELS.length - 1 && (
                  <span className="text-gray-400 text-xs" aria-hidden="true">›</span>
                )}
              </span>
            ))}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
      </button>

      {expanded && (
        <div id="hierarchy-legend-body" className="border-t border-gray-200 px-4 py-4 bg-gray-50 space-y-3">
          <p className="text-xs text-gray-600 font-poppins leading-relaxed">
            Atos de nível mais baixo (número maior) não podem revogar nem alterar atos de nível mais alto.
            Quando isso aparece numa relação, o sistema marca como <strong>atípico</strong> — geralmente
            é falso positivo do detector, mas pode revelar exceções legítimas (ex: a própria lei revogada
            citada num decreto regulamentador).
          </p>
          <ol className="space-y-2">
            {LEVELS.map((l) => (
              <li key={l.level} className="flex items-start gap-3">
                <span className="text-xs font-mono font-bold text-gray-500 w-4 flex-shrink-0 mt-1">{l.level}.</span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded border ${l.color} flex-shrink-0`}>
                  {l.label}
                </span>
                <span className="text-xs text-gray-700 font-poppins leading-relaxed">{l.description}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
