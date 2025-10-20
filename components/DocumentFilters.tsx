'use client';

import { useState } from 'react';
import { Search, Filter, X, SortAsc } from 'lucide-react';

export interface DocumentFilterState {
  searchQuery: string;
  category: string;
  type: string;
  sortBy: 'recent' | 'title' | 'category';
}

interface DocumentFiltersProps {
  filters: DocumentFilterState;
  onFilterChange: (filters: DocumentFilterState) => void;
  categories?: string[];
  types?: string[];
}

export default function DocumentFilters({
  filters,
  onFilterChange,
  categories = ['apostila', 'acordao', 'parecer', 'edital', 'artigo', 'outro'],
  types = ['pdf', 'doc', 'video', 'link'],
}: DocumentFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = (value: string) => {
    onFilterChange({ ...filters, searchQuery: value });
  };

  const handleCategoryChange = (value: string) => {
    onFilterChange({ ...filters, category: value });
  };

  const handleTypeChange = (value: string) => {
    onFilterChange({ ...filters, type: value });
  };

  const handleSortChange = (value: 'recent' | 'title' | 'category') => {
    onFilterChange({ ...filters, sortBy: value });
  };

  const clearFilters = () => {
    onFilterChange({
      searchQuery: '',
      category: '',
      type: '',
      sortBy: 'recent',
    });
  };

  const hasActiveFilters = filters.category || filters.type || filters.searchQuery;

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      apostila: 'Apostila',
      acordao: 'Acórdão',
      parecer: 'Parecer',
      edital: 'Edital',
      artigo: 'Artigo',
      outro: 'Outro',
    };
    return labels[cat] || cat;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pdf: 'PDF',
      doc: 'DOC/DOCX',
      video: 'Vídeo',
      link: 'Link',
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-6 border-2 border-gray-200">
      {/* Barra de Busca */}
      <div className="flex gap-3 items-center mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={filters.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
            showFilters
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtros
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-100 transition-colors"
          >
            <X className="w-4 h-4" />
            Limpar
          </button>
        )}
      </div>

      {/* Painel de Filtros Avançados */}
      {showFilters && (
        <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          {/* Categoria */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categoria
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
            >
              <option value="">Todas</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {getCategoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de Arquivo
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
            >
              <option value="">Todos</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {getTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenação */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <SortAsc className="w-4 h-4" />
              Ordenar Por
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleSortChange(e.target.value as "recent" | "title" | "category")}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
            >
              <option value="recent">Mais Recentes</option>
              <option value="title">Título (A-Z)</option>
              <option value="category">Categoria</option>
            </select>
          </div>
        </div>
      )}

      {/* Tags de Filtros Ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm font-semibold text-gray-600">Filtros ativos:</span>

          {filters.searchQuery && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Busca: &quot;{filters.searchQuery}&quot;
              <button
                onClick={() => handleSearchChange('')}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.category && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              {getCategoryLabel(filters.category)}
              <button
                onClick={() => handleCategoryChange('')}
                className="hover:bg-purple-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.type && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {getTypeLabel(filters.type)}
              <button
                onClick={() => handleTypeChange('')}
                className="hover:bg-green-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
