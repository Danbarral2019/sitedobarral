'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

/**
 * Legenda visual da hierarquia normativa.
 *
 * Padrão usado nos badges de tipo em toda a app:
 *   Lei (h=1) vermelho · Decreto (h=2) azul · Portaria (h=3) verde
 *   IN (h=4) roxo · OS (h=5) amarelo
 *
 * Mostra a pirâmide compacta por default; expandida traz descrição e
 * caveat sobre Lei Complementar e Medida Provisória.
 */

const LEVELS = [
  {
    level: 1,
    label: 'Lei',
    color: 'bg-red-100 text-red-800 border-red-300',
    description: 'Norma de hierarquia máxima. Inclui Lei Ordinária, Lei Complementar e Medida Provisória (que tem força de lei até conversão).',
  },
  {
    level: 2,
    label: 'Decreto',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Regulamenta lei. Editado pelo chefe do Executivo (Presidente, Governador, Prefeito).',
  },
  {
    level: 3,
    label: 'Portaria',
    color: 'bg-green-100 text-green-800 border-green-300',
    description: 'Ato de Ministro ou autoridade equivalente. Não pode contrariar lei nem decreto.',
  },
  {
    level: 4,
    label: 'IN · Resolução',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Instrução Normativa ou Resolução, geralmente de Secretaria ou órgão técnico. Detalha portaria/decreto.',
  },
  {
    level: 5,
    label: 'OS',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    description: 'Ordem de Serviço. Ato interno operacional, menor amplitude.',
  },
];

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
