import { ExternalLink, Gavel } from 'lucide-react';
import type { LegislativeActResult } from '@/lib/types/global-search';
import { highlightText } from './search-utils';

export interface LegislativeActResultCardProps {
  act: LegislativeActResult;
  query: string;
}

export function LegislativeActResultCard({ act, query }: LegislativeActResultCardProps) {
  const typeLabels: Record<string, string> = {
    decreto: 'Decreto',
    portaria: 'Portaria',
    in: 'Instrução Normativa',
    'ordem-servico': 'Ordem de Serviço',
    lei: 'Lei',
    'medida-provisoria': 'Medida Provisória',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-300 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
          <Gavel className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm">
            {highlightText(act.fullNumber, query)}
          </h4>
          <p className="text-sm text-gray-600 mt-1 line-clamp-3">
            {highlightText(act.ementa.slice(0, 250), query)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {typeLabels[act.type] || act.type}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {act.issuer}
            </span>
            {act.leiArticles.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                Art. {act.leiArticles.slice(0, 3).join(', ')}{act.leiArticles.length > 3 ? '...' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {act.officialUrl && (
              <a
                href={act.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
              >
                <ExternalLink className="w-3 h-3" />
                Texto oficial
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
