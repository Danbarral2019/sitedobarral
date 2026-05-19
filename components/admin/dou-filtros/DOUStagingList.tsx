'use client';

import type { DOUPendingDocument } from '@/hooks/use-dou-filtros';

export type DOUStagingVariant = 'auto-approved' | 'pending';

interface VariantTheme {
  containerBg: string;
  containerBorder: string;
  cardBorder: string;
  titleColor: string;
  badge: string;
  badgeText: string;
  description: string;
  statusBadge: string;
  spinner: string;
  formatDate: (d: string) => string;
}

const THEMES: Record<DOUStagingVariant, VariantTheme> = {
  'auto-approved': {
    containerBg: 'bg-green-50',
    containerBorder: 'border-green-400',
    cardBorder: 'border-green-200',
    titleColor: 'text-green-900',
    badge: 'bg-green-200',
    badgeText: 'text-green-900',
    description:
      '🤖 Documentos classificados como alta relevância pelo sistema automático. <strong>Revise e valide</strong> para incorporar ao acervo.',
    statusBadge: 'bg-green-100 text-green-900 font-bold',
    spinner: '✅',
    formatDate: (d: string) => d,
  },
  pending: {
    containerBg: 'bg-yellow-50',
    containerBorder: 'border-yellow-300',
    cardBorder: 'border-yellow-200',
    titleColor: 'text-yellow-900',
    badge: 'bg-yellow-200',
    badgeText: 'text-yellow-900',
    description: '📋 Estes documentos foram classificados como potencialmente relevantes e aguardam aprovação manual.',
    statusBadge: 'bg-yellow-100 text-yellow-800 font-medium',
    spinner: '⏳',
    formatDate: (d: string) => new Date(d).toLocaleDateString('pt-BR'),
  },
};

const TITLES: Record<DOUStagingVariant, string> = {
  'auto-approved': '✅ Documentos Auto-Aprovados - Validação Necessária',
  pending: '⏳ Documentos Pendentes de Revisão',
};

const STATUS_LABELS: Record<DOUStagingVariant, string> = {
  'auto-approved': 'Auto-aprovado',
  pending: 'Aguardando revisao',
};

interface DOUStagingListProps {
  variant: DOUStagingVariant;
  isLoading: boolean;
  docs: DOUPendingDocument[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onView: (doc: DOUPendingDocument) => void;
}

export function DOUStagingList({ variant, isLoading, docs, selectedIds, onToggleSelect, onView }: DOUStagingListProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="text-center py-8 text-gray-500">
          <div className="animate-spin text-4xl mb-2">{THEMES[variant].spinner}</div>
          <p>Carregando documentos {variant === 'pending' ? 'pendentes' : 'auto-aprovados'}...</p>
        </div>
      </div>
    );
  }

  if (docs.length === 0) return null;

  const theme = THEMES[variant];

  return (
    <div className={`${theme.containerBg} border-2 ${theme.containerBorder} rounded-lg shadow-md p-6 mb-6`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold ${theme.titleColor}`}>{TITLES[variant]}</h2>
        <span className={`${theme.badge} ${theme.badgeText} px-3 py-1 rounded-full text-sm font-bold`}>
          {docs.length} {docs.length === 1 ? 'documento' : 'documentos'}
        </span>
      </div>
      <p
        className={`text-sm ${theme.titleColor.replace('900', '800')} mb-4`}
        dangerouslySetInnerHTML={{ __html: theme.description }}
      />

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className={`bg-white border ${theme.cardBorder} rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer flex gap-3`}
          >
            <div className="flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selectedIds.has(doc.id)}
                onChange={() => onToggleSelect(doc.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1" onClick={() => onView(doc)}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded uppercase font-bold">
                      {doc.section}
                    </span>
                    <span className="text-xs text-gray-500">{theme.formatDate(doc.publishDate)}</span>
                  </div>
                  <h3
                    className="font-medium text-sm mb-1 text-gray-900"
                    dangerouslySetInnerHTML={{
                      __html: doc.title.substring(0, 150) + (doc.title.length > 150 ? '...' : ''),
                    }}
                  />
                  {doc.hierarchyStr && <div className="text-xs text-gray-600">{doc.hierarchyStr}</div>}
                  {doc.abstract && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {doc.abstract.substring(0, 250)}
                      {doc.abstract.length > 250 ? '...' : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className={`px-2 py-1 rounded ${theme.statusBadge}`}>{STATUS_LABELS[variant]}</span>
                  <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded font-medium">{doc.category}</span>
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">
                    {doc.confidence}% confianca
                  </span>
                </div>
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium"
                  >
                    Inteiro Teor
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`mt-4 pt-4 border-t ${theme.cardBorder}`}>
        <p className={`text-xs ${theme.titleColor.replace('900', '800')}`}>
          Clique em um documento para revisar ou use os checkboxes para operacoes em lote.
        </p>
      </div>
    </div>
  );
}
