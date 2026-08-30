'use client';

import { Filter } from 'lucide-react';

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryFilter({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryFilterProps) {
  if (categories.length === 0) return null;

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700">Filtrar por Categoria</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCategoryChange(null)}
          className={`
            px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${!activeCategory
              ? 'bg-blue-600 text-surface-page'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }
          `}
        >
          Todas
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${activeCategory === category
                ? 'bg-blue-600 text-surface-page'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }
            `}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
