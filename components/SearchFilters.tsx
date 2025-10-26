'use client';

import { X, Trash2, FileText } from 'lucide-react';
import { SearchFilters as SearchFiltersType } from '@/hooks/use-search';
import { ARTIGOS_POPULARES, LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

interface Course {
  id: string;
  title: string;
}

interface SearchFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  filters: SearchFiltersType;
  onUpdateFilters: (filters: Partial<SearchFiltersType>) => void;
  onClearFilters: () => void;
  availableCourses: Course[];
}

const CATEGORIES = [
  { value: 'acordao', label: 'Acórdãos' },
  { value: 'parecer', label: 'Pareceres' },
  { value: 'artigo', label: 'Artigos' },
  { value: 'edital', label: 'Editais' },
  { value: 'apostila', label: 'Apostilas' },
  { value: 'conteudo-programatico', label: 'Conteúdo Programático' },
  { value: 'bibliografia', label: 'Bibliografia' },
  { value: 'link', label: 'Links' },
  { value: 'video', label: 'Vídeos' },
  { value: 'outro', label: 'Outros' },
];

const TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'DOC/DOCX' },
  { value: 'link', label: 'Link Externo' },
  { value: 'video', label: 'Vídeo' },
];

const DATE_RANGES = [
  { value: 'all', label: 'Todos os períodos' },
  { value: '7days', label: 'Últimos 7 dias' },
  { value: '30days', label: 'Últimos 30 dias' },
  { value: '90days', label: 'Últimos 90 dias' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Mais Relevantes' },
  { value: 'newest', label: 'Mais Recentes' },
  { value: 'oldest', label: 'Mais Antigos' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
];

export default function SearchFilters({
  isOpen,
  onClose,
  filters,
  onUpdateFilters,
  onClearFilters,
  availableCourses,
}: SearchFiltersProps) {
  if (!isOpen) return null;

  const toggleCourse = (courseId: string) => {
    const newCourseIds = filters.courseIds.includes(courseId)
      ? filters.courseIds.filter(id => id !== courseId)
      : [...filters.courseIds, courseId];
    onUpdateFilters({ courseIds: newCourseIds });
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onUpdateFilters({ categories: newCategories });
  };

  const toggleType = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onUpdateFilters({ types: newTypes });
  };

  const toggleArticle = (articleNumber: string) => {
    const newArticles = filters.leiArticles.includes(articleNumber)
      ? filters.leiArticles.filter(a => a !== articleNumber)
      : [...filters.leiArticles, articleNumber];
    onUpdateFilters({ leiArticles: newArticles });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 lg:p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Filtros Avançados</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Botão Limpar Filtros */}
          <button
            onClick={() => {
              onClearFilters();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="font-medium">Limpar Todos os Filtros</span>
          </button>
        </div>

        {/* Conteúdo dos Filtros */}
        <div className="p-4 lg:p-6 space-y-6">
          {/* Filtro por Curso */}
          {availableCourses.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                Cursos ({filters.courseIds.length} selecionados)
              </h3>
              <div className="space-y-2">
                {availableCourses.map(course => (
                  <label
                    key={course.id}
                    className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={filters.courseIds.includes(course.id)}
                      onChange={() => toggleCourse(course.id)}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900 flex-1">{course.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Filtro por Categoria */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              Categorias ({filters.categories.length} selecionadas)
            </h3>
            <div className="space-y-2">
              {CATEGORIES.map(category => (
                <label
                  key={category.value}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category.value)}
                    onChange={() => toggleCategory(category.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">{category.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filtro por Tipo */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              Tipo de Arquivo ({filters.types.length} selecionados)
            </h3>
            <div className="space-y-2">
              {TYPES.map(type => (
                <label
                  key={type.value}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters.types.includes(type.value)}
                    onChange={() => toggleType(type.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filtro por Artigos da Lei 14.133/2021 */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-600" />
              Lei 14.133/2021 ({filters.leiArticles.length} selecionados)
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Filtre documentos relacionados a artigos específicos da Lei 14.133/2021
            </p>

            {/* Artigos Populares */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">📌 Artigos Populares</p>
              <div className="flex flex-wrap gap-2">
                {ARTIGOS_POPULARES.map(articleNum => {
                  const article = LEI_14133_ARTIGOS[articleNum];
                  const isSelected = filters.leiArticles.includes(articleNum);
                  return (
                    <button
                      key={articleNum}
                      onClick={() => toggleArticle(articleNum)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-orange-600 text-white shadow-md'
                          : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                      }`}
                      title={article?.ementa}
                    >
                      Art. {articleNum}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Artigos Selecionados (não populares) */}
            {filters.leiArticles.filter(a => !ARTIGOS_POPULARES.includes(a)).length > 0 && (
              <div className="mb-3 pb-3 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">Outros Artigos Selecionados</p>
                <div className="flex flex-wrap gap-2">
                  {filters.leiArticles
                    .filter(a => !ARTIGOS_POPULARES.includes(a))
                    .map(articleNum => {
                      const article = LEI_14133_ARTIGOS[articleNum];
                      return (
                        <button
                          key={articleNum}
                          onClick={() => toggleArticle(articleNum)}
                          className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium shadow-md hover:bg-orange-700 transition-all"
                          title={article?.ementa}
                        >
                          Art. {articleNum} ✕
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Input para adicionar artigo específico */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Adicionar Artigo Específico</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="193"
                  placeholder="Nº do artigo (1-193)"
                  className="flex-1 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-600"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.target as HTMLInputElement;
                      const num = input.value.trim();
                      if (num && LEI_14133_ARTIGOS[num] && !filters.leiArticles.includes(num)) {
                        toggleArticle(num);
                        input.value = '';
                      }
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    const num = input.value.trim();
                    if (num && LEI_14133_ARTIGOS[num] && !filters.leiArticles.includes(num)) {
                      toggleArticle(num);
                      input.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors"
                >
                  + Add
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Digite o número e pressione Enter ou clique em &quot;+ Add&quot;
              </p>
            </div>
          </div>

          {/* Filtro por Data */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Período</h3>
            <div className="space-y-2">
              {DATE_RANGES.map(range => (
                <label
                  key={range.value}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="dateRange"
                    value={range.value}
                    checked={filters.dateRange === range.value}
                    onChange={(e) => onUpdateFilters({ dateRange: e.target.value as SearchFiltersType['dateRange'] })}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">{range.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Apenas Favoritos */}
          <div>
            <label className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border-2 border-gray-200">
              <input
                type="checkbox"
                checked={filters.favoritesOnly}
                onChange={(e) => onUpdateFilters({ favoritesOnly: e.target.checked })}
                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
              />
              <span className="text-sm font-medium text-gray-900">❤️ Apenas Favoritos</span>
            </label>
          </div>

          {/* Ordenação */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Ordenar Por</h3>
            <div className="space-y-2">
              {SORT_OPTIONS.map(option => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="sortBy"
                    value={option.value}
                    checked={filters.sortBy === option.value}
                    onChange={(e) => onUpdateFilters({ sortBy: e.target.value as SearchFiltersType['sortBy'] })}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 p-4 lg:p-6">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </>
  );
}
