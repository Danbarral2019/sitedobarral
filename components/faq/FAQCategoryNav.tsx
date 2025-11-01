'use client';

interface FAQCategoryNavProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function FAQCategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
}: FAQCategoryNavProps) {
  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8 overflow-x-auto">
        <button
          onClick={() => onCategoryChange(null)}
          className={`
            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
            ${!activeCategory
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
          `}
        >
          Todas as Perguntas
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeCategory === category
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {category}
          </button>
        ))}
      </nav>
    </div>
  );
}
