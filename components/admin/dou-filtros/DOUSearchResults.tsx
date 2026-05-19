'use client';

import type { DOUSearchResponse, DOUSearchResult, DOUStatusTab } from '@/hooks/use-dou-filtros';

interface DOUSearchResultsProps {
  data: DOUSearchResponse;
  selectedTab: DOUStatusTab;
  onTabChange: (tab: DOUStatusTab) => void;
  onViewDetails: (result: DOUSearchResult) => void;
}

const STATUS_LABEL: Record<string, string> = {
  auto_approved: '✅ Auto-aprovado',
  pending: '⏳ Revisão',
  auto_rejected: '❌ Rejeitado',
};

const STATUS_COLOR: Record<string, string> = {
  auto_approved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  auto_rejected: 'bg-red-100 text-red-800',
};

export function DOUSearchResults({ data, selectedTab, onTabChange, onViewDetails }: DOUSearchResultsProps) {
  const tabs = [
    { key: 'pending' as const, label: '⏳ Revisão', count: data.results.filter((r) => r.status === 'pending').length },
    { key: 'approved' as const, label: '✅ Auto-aprovados', count: data.results.filter((r) => r.status === 'auto_approved').length },
    { key: 'rejected' as const, label: '❌ Rejeitados', count: data.results.filter((r) => r.status === 'auto_rejected').length },
    { key: 'all' as const, label: '📋 Todos', count: data.results.length },
  ];

  const filteredResults =
    selectedTab === 'all'
      ? data.results
      : data.results.filter((r) => {
          if (selectedTab === 'pending') return r.status === 'pending';
          if (selectedTab === 'approved') return r.status === 'auto_approved';
          if (selectedTab === 'rejected') return r.status === 'auto_rejected';
          return true;
        });

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">📊 Estatísticas</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Stat label="Total" value={data.stats.total} color="text-gray-900" />
          <Stat label="Auto-aprovados" value={data.stats.autoApproved} color="text-green-600" />
          <Stat label="Revisão" value={data.stats.pending} color="text-yellow-600" />
          <Stat label="Rejeitados" value={data.stats.autoRejected} color="text-red-600" />
        </div>

        <div className="border-t pt-4">
          <h3 className="font-bold mb-2">Impacto dos Filtros:</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Documentos filtrados:</span>
              <span className="font-bold ml-2">{data.filterStats.filteredCount}</span>
            </div>
            <div>
              <span className="text-gray-600">Removidos:</span>
              <span className="font-bold ml-2">
                {data.filterStats.removedCount} ({data.filterStats.removalRate})
              </span>
            </div>
          </div>
          {data.filterStats.appliedFilters.length > 0 && (
            <div className="mt-2">
              <span className="text-gray-600 text-sm">Filtros aplicados:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {data.filterStats.appliedFilters.map((filter, i) => (
                  <span key={i} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    {filter}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-2">📄 Documentos Encontrados ({data.results.length})</h2>
        <p className="text-sm text-gray-600 mb-4">Ordenados por: ⏳ Revisão → ✅ Auto-aprovados → ❌ Rejeitados</p>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                selectedTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {filteredResults.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">🔍</div>
            <p>Nenhum documento encontrado nesta categoria</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResults.map((result, index) => (
              <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded uppercase font-bold">
                        {result.section}
                      </span>
                      <span className="text-xs text-gray-500">{result.date}</span>
                    </div>
                    <h3
                      className="font-medium text-sm mb-1"
                      dangerouslySetInnerHTML={{ __html: result.title.substring(0, 150) + '...' }}
                    />
                    <div className="text-xs text-gray-600">{result.hierarchyStr}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded ${STATUS_COLOR[result.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABEL[result.status] ?? result.status}
                    </span>
                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">{result.category}</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      Confiança: {result.confidence}%
                    </span>
                  </div>

                  <button
                    onClick={() => onViewDetails(result)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                  >
                    📄 Ver Detalhes
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
