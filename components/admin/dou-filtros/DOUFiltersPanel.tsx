'use client';

import { DateRangePreset } from '@/lib/dou-classifier';
import {
  DOU_SECTIONS,
  DOU_DATE_PRESETS,
  type DOUFilterConfig,
} from '@/lib/admin/dou-filtros/defaults';

interface DOUFiltersPanelProps {
  filters: DOUFilterConfig;
  onFiltersChange: (filters: DOUFilterConfig) => void;
  onSearch: () => void;
  onClear: () => void;
  isLoading: boolean;
}

export function DOUFiltersPanel({ filters, onFiltersChange, onSearch, onClear, isLoading }: DOUFiltersPanelProps) {
  const toggleSection = (value: string, checked: boolean) => {
    onFiltersChange({
      ...filters,
      sections: checked ? [...filters.sections, value] : filters.sections.filter((s) => s !== value),
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
      <h2 className="text-xl font-bold mb-4">🔍 Configurar Filtros</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Termo de Busca</label>
        <input
          type="text"
          value={filters.searchTerm}
          onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="licitação OR pregão"
        />
        <p className="text-xs text-gray-500 mt-1">Use OR, AND para combinar termos</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Seções do DOU</label>
        <div className="space-y-2">
          {DOU_SECTIONS.map((section) => (
            <label key={section.value} className="flex items-center">
              <input
                type="checkbox"
                checked={filters.sections.includes(section.value)}
                onChange={(e) => toggleSection(section.value, e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">{section.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Período</label>
        <select
          value={filters.datePreset}
          onChange={(e) =>
            onFiltersChange({ ...filters, datePreset: e.target.value as DateRangePreset | 'custom' })
          }
          className="w-full px-3 py-2 border rounded-lg"
        >
          {DOU_DATE_PRESETS.map((preset) => (
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
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Data início"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Data fim"
            />
          </div>
        )}
      </div>

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
            onFiltersChange({ ...filters, minConfidence: parseInt(e.target.value) })
          }
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
          💡 <strong>Confiança</strong> indica o quão certo o sistema de IA está sobre a classificação do documento.
          Use valores maiores (70-100%) para ver apenas documentos com alta certeza de relevância.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Incluir Keywords (separadas por vírgula)</label>
        <input
          type="text"
          value={filters.includeKeywords}
          onChange={(e) => onFiltersChange({ ...filters, includeKeywords: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="pregão, dispensa, inexigibilidade"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Excluir Keywords (separadas por vírgula)</label>
        <input
          type="text"
          value={filters.excludeKeywords}
          onChange={(e) => onFiltersChange({ ...filters, excludeKeywords: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="militar, saúde, educação"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Máximo de Resultados</label>
        <input
          type="number"
          value={filters.maxResults}
          onChange={(e) =>
            onFiltersChange({ ...filters, maxResults: parseInt(e.target.value) || 50 })
          }
          className="w-full px-3 py-2 border rounded-lg"
          min="10"
          max="500"
        />
      </div>

      <div className="space-y-2">
        <button
          onClick={onSearch}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? '🔍 Buscando...' : '🔍 Buscar Documentos'}
        </button>
        <button
          onClick={onClear}
          className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
        >
          🗑️ Limpar Filtros
        </button>
      </div>
    </div>
  );
}
