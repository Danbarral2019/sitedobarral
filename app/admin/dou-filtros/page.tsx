'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import {
  DOUDocumentCategory,
  ApprovalStatus,
  DateRangePreset,
  RELEVANT_ORGAOS,
} from '@/lib/dou-classifier';

interface FilterConfig {
  // Filtros básicos
  searchTerm: string;
  sections: string[];

  // Filtros por órgão
  selectedOrgaos: string[];
  customOrgao: string;

  // Filtros por data
  datePreset: DateRangePreset | 'custom';
  dateFrom: string;
  dateTo: string;

  // Filtros por classificação
  categories: DOUDocumentCategory[];
  statuses: ApprovalStatus[];
  minConfidence: number;

  // Filtros por keywords
  includeKeywords: string;
  excludeKeywords: string;

  // Configurações de busca
  maxResults: number;
}

interface SearchResult {
  section: string;
  title: string;
  date: string;
  category: string;
  status: string;
  confidence: number;
  hierarchyStr: string;
}

interface SearchResponse {
  results: SearchResult[];
  stats: {
    total: number;
    autoApproved: number;
    pending: number;
    autoRejected: number;
    filtered: number;
  };
  filterStats: {
    originalCount: number;
    filteredCount: number;
    removedCount: number;
    removalRate: string;
    appliedFilters: string[];
  };
}

export default function DOUFiltrosPage() {
  const [filters, setFilters] = useState<FilterConfig>({
    searchTerm: 'licitação OR pregão',
    sections: [],
    selectedOrgaos: [],
    customOrgao: '',
    datePreset: DateRangePreset.ULTIMA_SEMANA,
    dateFrom: '',
    dateTo: '',
    categories: [],
    statuses: [],
    minConfidence: 0,
    includeKeywords: '',
    excludeKeywords: '',
    maxResults: 50,
  });

  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seções disponíveis
  const sections = [
    { value: 'do1', label: 'Seção 1 - Leis e Decretos' },
    { value: 'do2', label: 'Seção 2 - Atos de Pessoal' },
    { value: 'do3', label: 'Seção 3 - Contratos e Licitações' },
    { value: 'doe', label: 'Edições Extra' },
  ];

  // Órgãos relevantes
  const orgaos = [
    { value: 'agu', label: 'AGU - Advocacia-Geral da União', keywords: RELEVANT_ORGAOS.AGU },
    { value: 'tcu', label: 'TCU - Tribunal de Contas da União', keywords: RELEVANT_ORGAOS.TCU },
    { value: 'cgu', label: 'CGU - Controladoria-Geral da União', keywords: RELEVANT_ORGAOS.CGU },
    { value: 'mgi', label: 'MGI - Ministério da Gestão', keywords: RELEVANT_ORGAOS.MGI },
    { value: 'presidencia', label: 'Presidência da República', keywords: RELEVANT_ORGAOS.PRESIDENCIA },
  ];

  // Categorias de documentos
  const categoriesOptions = [
    { value: DOUDocumentCategory.FONTE_AGU, label: '✅ Fonte AGU (sempre relevante)' },
    { value: DOUDocumentCategory.ATO_NORMATIVO, label: '✅ Ato Normativo (leis, decretos)' },
    { value: DOUDocumentCategory.SUMULA, label: '✅ Súmula' },
    { value: DOUDocumentCategory.ACORDAO_TCU, label: '⏳ Acórdão TCU (revisão manual)' },
    { value: DOUDocumentCategory.PARECER_ORGAO, label: '⏳ Parecer de Órgão' },
    { value: DOUDocumentCategory.RESOLUCAO, label: '⏳ Resolução' },
  ];

  // Status de aprovação
  const statusOptions = [
    { value: ApprovalStatus.AUTO_APPROVED, label: '✅ Auto-aprovado' },
    { value: ApprovalStatus.PENDING, label: '⏳ Aguardando revisão' },
    { value: ApprovalStatus.AUTO_REJECTED, label: '❌ Auto-rejeitado' },
  ];

  // Presets de data
  const datePresets = [
    { value: DateRangePreset.HOJE, label: 'Hoje' },
    { value: DateRangePreset.ONTEM, label: 'Ontem' },
    { value: DateRangePreset.ULTIMA_SEMANA, label: 'Última semana' },
    { value: DateRangePreset.ULTIMO_MES, label: 'Último mês' },
    { value: DateRangePreset.ULTIMOS_3_MESES, label: 'Últimos 3 meses' },
    { value: 'custom', label: 'Personalizado' },
  ];

  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/dou/search-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar documentos');
      }

      const data = await response.json();
      setSearchResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      searchTerm: 'licitação OR pregão',
      sections: [],
      selectedOrgaos: [],
      customOrgao: '',
      datePreset: DateRangePreset.ULTIMA_SEMANA,
      dateFrom: '',
      dateTo: '',
      categories: [],
      statuses: [],
      minConfidence: 0,
      includeKeywords: '',
      excludeKeywords: '',
      maxResults: 50,
    });
    setSearchResponse(null);
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Filtros Avançados DOU</h1>
          <p className="text-gray-600">
            Configure filtros para buscar documentos específicos no Diário Oficial da União
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Painel de Filtros */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">🔍 Configurar Filtros</h2>

              {/* Termo de Busca */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Termo de Busca
                </label>
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="licitação OR pregão"
                />
                <p className="text-xs text-gray-500 mt-1">Use OR, AND para combinar termos</p>
              </div>

              {/* Seções */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Seções do DOU
                </label>
                <div className="space-y-2">
                  {sections.map((section) => (
                    <label key={section.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.sections.includes(section.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({
                              ...filters,
                              sections: [...filters.sections, section.value],
                            });
                          } else {
                            setFilters({
                              ...filters,
                              sections: filters.sections.filter((s) => s !== section.value),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{section.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Órgãos */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Órgãos/Ministérios
                </label>
                <div className="space-y-2">
                  {orgaos.map((orgao) => (
                    <label key={orgao.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.selectedOrgaos.includes(orgao.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({
                              ...filters,
                              selectedOrgaos: [...filters.selectedOrgaos, orgao.value],
                            });
                          } else {
                            setFilters({
                              ...filters,
                              selectedOrgaos: filters.selectedOrgaos.filter(
                                (o) => o !== orgao.value
                              ),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{orgao.label}</span>
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={filters.customOrgao}
                  onChange={(e) => setFilters({ ...filters, customOrgao: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg mt-2"
                  placeholder="Órgão customizado..."
                />
              </div>

              {/* Data */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Período
                </label>
                <select
                  value={filters.datePreset}
                  onChange={(e) => setFilters({ ...filters, datePreset: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {datePresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                {filters.datePreset === 'custom' && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Data início"
                    />
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Data fim"
                    />
                  </div>
                )}
              </div>

              {/* Categorias */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Categorias
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {categoriesOptions.map((cat) => (
                    <label key={cat.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.categories.includes(cat.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({
                              ...filters,
                              categories: [...filters.categories, cat.value],
                            });
                          } else {
                            setFilters({
                              ...filters,
                              categories: filters.categories.filter((c) => c !== cat.value),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-xs">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Status de Aprovação
                </label>
                <div className="space-y-2">
                  {statusOptions.map((status) => (
                    <label key={status.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.statuses.includes(status.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({
                              ...filters,
                              statuses: [...filters.statuses, status.value],
                            });
                          } else {
                            setFilters({
                              ...filters,
                              statuses: filters.statuses.filter((s) => s !== status.value),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Confiança Mínima */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Confiança Mínima: {filters.minConfidence}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={filters.minConfidence}
                  onChange={(e) =>
                    setFilters({ ...filters, minConfidence: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Keywords */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Incluir Keywords (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={filters.includeKeywords}
                  onChange={(e) => setFilters({ ...filters, includeKeywords: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="pregão, dispensa, inexigibilidade"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Excluir Keywords (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={filters.excludeKeywords}
                  onChange={(e) => setFilters({ ...filters, excludeKeywords: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="militar, saúde, educação"
                />
              </div>

              {/* Máximo de Resultados */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Máximo de Resultados
                </label>
                <input
                  type="number"
                  value={filters.maxResults}
                  onChange={(e) =>
                    setFilters({ ...filters, maxResults: parseInt(e.target.value) || 50 })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  min="10"
                  max="500"
                />
              </div>

              {/* Botões */}
              <div className="space-y-2">
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isLoading ? '🔍 Buscando...' : '🔍 Buscar Documentos'}
                </button>
                <button
                  onClick={handleClearFilters}
                  className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                >
                  🗑️ Limpar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Painel de Resultados */}
          <div className="lg:col-span-2">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
                ❌ {error}
              </div>
            )}

            {searchResponse && (
              <>
                {/* Estatísticas */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4">📊 Estatísticas</h2>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900">
                        {searchResponse.stats.total}
                      </div>
                      <div className="text-sm text-gray-600">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {searchResponse.stats.autoApproved}
                      </div>
                      <div className="text-sm text-gray-600">Auto-aprovados</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600">
                        {searchResponse.stats.pending}
                      </div>
                      <div className="text-sm text-gray-600">Revisão</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">
                        {searchResponse.stats.autoRejected}
                      </div>
                      <div className="text-sm text-gray-600">Rejeitados</div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2">Impacto dos Filtros:</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Documentos filtrados:</span>
                        <span className="font-bold ml-2">
                          {searchResponse.filterStats.filteredCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Removidos:</span>
                        <span className="font-bold ml-2">
                          {searchResponse.filterStats.removedCount} (
                          {searchResponse.filterStats.removalRate})
                        </span>
                      </div>
                    </div>
                    {searchResponse.filterStats.appliedFilters.length > 0 && (
                      <div className="mt-2">
                        <span className="text-gray-600 text-sm">Filtros aplicados:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {searchResponse.filterStats.appliedFilters.map((filter, i) => (
                            <span
                              key={i}
                              className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                            >
                              {filter}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lista de Documentos */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold mb-4">
                    📄 Documentos Encontrados ({searchResponse.results.length})
                  </h2>

                  {searchResponse.results.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-4xl mb-2">🔍</div>
                      <p>Nenhum documento encontrado com os filtros selecionados</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {searchResponse.results.map((result, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
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
                                dangerouslySetInnerHTML={{
                                  __html: result.title.substring(0, 150) + '...',
                                }}
                              />
                              <div className="text-xs text-gray-600">{result.hierarchyStr}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`px-2 py-1 rounded ${
                                result.status === 'auto_approved'
                                  ? 'bg-green-100 text-green-800'
                                  : result.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {result.status === 'auto_approved'
                                ? '✅ Auto-aprovado'
                                : result.status === 'pending'
                                ? '⏳ Revisão'
                                : '❌ Rejeitado'}
                            </span>
                            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                              {result.category}
                            </span>
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              Confiança: {result.confidence}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {!searchResponse && !isLoading && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold mb-2">Configure os filtros e busque</h3>
                <p>
                  Use o painel à esquerda para configurar filtros avançados e encontrar documentos
                  específicos no DOU
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
