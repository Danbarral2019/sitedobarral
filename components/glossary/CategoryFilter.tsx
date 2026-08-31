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
    <div className="bg-white border rounded-[6px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-ink-muted" />
        <h3 className="text-sm font-semibold text-ink-secondary">Filtrar por Categoria</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCategoryChange(null)}
          className={`
            px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${!activeCategory
              ? 'bg-brand-600 text-white'
              : 'bg-surface-deep hover:bg-border-subtle text-ink-secondary'
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
                ? 'bg-brand-600 text-white'
                : 'bg-surface-deep hover:bg-border-subtle text-ink-secondary'
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
