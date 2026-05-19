'use client';

import { Search, Filter, X, CheckSquare, Square } from 'lucide-react';
import { courses } from '@/data/courses';
import type { DocumentFilters as Filters } from '@/hooks/use-documentos-admin';

interface DocumentsFiltersProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  filters: Filters;
  onFilterChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  activeCount: number;
  resultCount: number;
  onClear: () => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function DocumentsFilters({
  searchTerm,
  onSearchChange,
  filters,
  onFilterChange,
  activeCount,
  resultCount,
  onClear,
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
}: DocumentsFiltersProps) {
  const showIndicator = activeCount > 0 || searchTerm;

  return (
    <div className="mb-6 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por titulo ou descricao..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <select
          value={filters.course}
          onChange={(e) => onFilterChange('course', e.target.value)}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
        >
          <option value="">Todos os cursos</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>

        <select
          value={filters.category}
          onChange={(e) => onFilterChange('category', e.target.value)}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
        >
          <option value="">Todas categorias</option>
          <option value="apostila">Apostila</option>
          <option value="acordao">Acordao</option>
          <option value="parecer">Parecer</option>
          <option value="orientacao-normativa">Orientacao Normativa (AGU)</option>
          <option value="enunciados">Enunciados</option>
          <option value="sumula">Sumula</option>
          <option value="edital">Edital</option>
          <option value="artigo">Artigo</option>
          <option value="outro">Outro</option>
        </select>

        <select
          value={filters.type}
          onChange={(e) => onFilterChange('type', e.target.value)}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="pdf">PDF</option>
          <option value="doc">DOC/DOCX</option>
          <option value="video">Video</option>
          <option value="link">Link</option>
        </select>

        <select
          value={filters.visibility}
          onChange={(e) => onFilterChange('visibility', e.target.value)}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
        >
          <option value="">Todas visibilidades</option>
          <option value="public">Publico</option>
          <option value="private">Restrito</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => onFilterChange('status', e.target.value)}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="complete">Completos</option>
          <option value="warning">Incompletos</option>
          <option value="critical">Criticos</option>
        </select>
      </div>

      {filters.category === 'enunciados' && (
        <div className="mt-3">
          <select
            value={filters.entity}
            onChange={(e) => onFilterChange('entity', e.target.value)}
            className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 text-sm bg-blue-50"
          >
            <option value="">Todas as entidades</option>
            <option value="IBDA">IBDA - Instituto Brasileiro de Direito Administrativo</option>
            <option value="INCP">INCP - Instituto Nacional da Contratacao Publica</option>
            <option value="CJF">CJF - Conselho da Justica Federal</option>
          </select>
        </div>
      )}

      {showIndicator && (
        <div className="flex items-center justify-between bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">
              {resultCount} documento{resultCount !== 1 ? 's' : ''} encontrado{resultCount !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-100 px-3 py-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Limpar filtros
          </button>
        </div>
      )}

      {totalCount > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            {selectedCount === totalCount ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            Selecionar todos ({totalCount})
          </button>

          {selectedCount > 0 && (
            <>
              <span className="text-gray-400">|</span>
              <button
                onClick={onDeselectAll}
                className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                <Square className="w-5 h-5" />
                Desselecionar todos
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
