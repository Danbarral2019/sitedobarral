'use client';

/**
 * ResourceListClient - Componente genérico para listas admin (Fase 7)
 *
 * Client Component reutilizável que renderiza:
 * - Header com título e descrição
 * - Estatísticas (opcional)
 * - Filtros dinâmicos
 * - Busca local
 * - Tabela com colunas configuráveis
 * - Ações em lote
 * - Paginação
 *
 * Usa useAdminList hook para gerenciar estado.
 */

import { useSearchParams } from 'next/navigation';
import { Search, Loader2, RefreshCw } from 'lucide-react';
import { useAdminList } from '@/hooks/use-admin-list';
import { Pagination } from '@/components/ui/pagination';
import {
  ResourceListClientProps,
  FilterConfig,
  ColumnConfig,
  BatchAction,
  RowAction,
} from '@/lib/types/admin-list';

export function ResourceListClient<T extends { id: string }>({
  initialData,
  config,
}: ResourceListClientProps<T>) {
  const searchParams = useSearchParams();

  const {
    selectedIds,
    isProcessing,
    localSearch,
    setLocalSearch,
    toggleSelection,
    selectAll,
    clearSelection,
    executeBatchAction,
    executeRowAction,
    filterItemsLocally,
    updateFilter,
    goToPage,
    refresh,
    selectedCount,
    hasSelection,
  } = useAdminList<T>();

  // Items filtrados localmente (busca visual)
  const searchKeys = config.columns.map((col) => col.id as keyof T);
  const filteredItems = config.showSearch
    ? filterItemsLocally(initialData.items, searchKeys)
    : initialData.items;

  // Stats customizadas
  const stats = config.showStats && config.getStats ? config.getStats(initialData.items) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{config.title}</h1>
        {config.description && <p className="text-gray-600">{config.description}</p>}
      </div>

        {/* Estatísticas */}
        {stats && (
          <div className={`grid grid-cols-1 md:grid-cols-${Math.min(stats.length, 4)} gap-4 mb-6`}>
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center gap-3">
                  <div className={`p-2 ${stat.color} rounded-lg`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        {config.filters && config.filters.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {config.filters.map((filter) => (
                <div key={filter.id} className={filter.width ? `md:col-span-${filter.width}` : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{filter.label}</label>
                  {filter.type === 'select' ? (
                    <select
                      value={searchParams.get(filter.id) || filter.defaultValue || ''}
                      onChange={(e) => updateFilter(filter.id, e.target.value || null)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {filter.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : filter.type === 'text' ? (
                    <input
                      type="text"
                      value={searchParams.get(filter.id) || filter.defaultValue || ''}
                      onChange={(e) => updateFilter(filter.id, e.target.value || null)}
                      placeholder={filter.placeholder}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Busca Local */}
        {config.showSearch && (
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={config.searchPlaceholder || 'Buscar...'}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Ações em Lote */}
        {hasSelection && config.batchActions && config.batchActions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">{selectedCount} item(s) selecionado(s)</p>
                <p className="text-sm text-blue-700">Escolha uma ação para aplicar</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 text-blue-700 hover:bg-blue-100 rounded-lg transition"
                >
                  Limpar Seleção
                </button>

                {config.batchActions.map((action) => {
                  const Icon = action.icon;
                  const colorClasses = {
                    primary: 'bg-blue-600 hover:bg-blue-700',
                    success: 'bg-green-600 hover:bg-green-700',
                    danger: 'bg-red-600 hover:bg-red-700',
                    warning: 'bg-yellow-600 hover:bg-yellow-700',
                  };

                  return (
                    <button
                      key={action.id}
                      onClick={() =>
                        executeBatchAction(async (ids, items) => {
                          await action.action(ids, items);
                          return { success: true, message: `${ids.length} item(s) processado(s)` };
                        }, initialData.items)
                      }
                      disabled={isProcessing}
                      className={`px-4 py-2 ${colorClasses[action.color]} text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50`}
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Ações Globais */}
        <div className="flex justify-between items-center mb-4">
          {config.allowSelection && (
            <button
              onClick={() => selectAll(filteredItems)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Selecionar Todos ({filteredItems.length})
            </button>
          )}

          <button
            onClick={refresh}
            className="ml-auto text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>

        {/* Tabela */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            {config.emptyIcon && <config.emptyIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />}
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {config.emptyMessage || 'Nenhum item encontrado'}
            </h3>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {config.allowSelection && (
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedCount === filteredItems.length && filteredItems.length > 0}
                          onChange={() => {
                            if (selectedCount === filteredItems.length) {
                              clearSelection();
                            } else {
                              selectAll(filteredItems);
                            }
                          }}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </th>
                    )}
                    {config.columns.map((col) => (
                      <th
                        key={col.id}
                        className={`px-6 py-3 text-${col.align || 'left'} text-xs font-medium text-gray-500 uppercase tracking-wider ${col.width || ''}`}
                      >
                        {col.label}
                      </th>
                    ))}
                    {config.rowActions && config.rowActions.length > 0 && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50 transition ${
                        selectedIds.has(item.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      {config.allowSelection && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelection(item.id)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      )}
                      {config.columns.map((col) => (
                        <td key={col.id} className={`px-6 py-4 whitespace-nowrap text-${col.align || 'left'}`}>
                          {col.render(item)}
                        </td>
                      ))}
                      {config.rowActions && config.rowActions.length > 0 && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {config.rowActions
                              .filter((action) => !action.show || action.show(item))
                              .map((action) => {
                                const Icon = action.icon;
                                return (
                                  <button
                                    key={action.id}
                                    onClick={() =>
                                      executeRowAction(
                                        action.action,
                                        item,
                                        { refreshOnSuccess: true }
                                      )
                                    }
                                    disabled={isProcessing}
                                    className={`p-2 ${action.color || 'text-blue-600'} hover:bg-gray-100 rounded-lg transition disabled:opacity-50`}
                                    title={action.label}
                                  >
                                    <Icon className="w-5 h-5" />
                                  </button>
                                );
                              })}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {initialData.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <Pagination
                  currentPage={initialData.page}
                  totalPages={initialData.totalPages}
                  onPageChange={goToPage}
                />
              </div>
            )}
          </div>
        )}
      </div>
  );
}
