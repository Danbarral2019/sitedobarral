'use client';

interface TribunalDecisionsPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

function buildPageNumbers(currentPage: number, totalPages: number): number[] {
  const max = Math.min(5, totalPages);
  return Array.from({ length: max }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (currentPage <= 3) return i + 1;
    if (currentPage >= totalPages - 2) return totalPages - 4 + i;
    return currentPage - 2 + i;
  });
}

export function TribunalDecisionsPagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: TribunalDecisionsPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="p-4 border-t flex items-center justify-between">
      <p className="text-sm text-gray-600">
        Pagina {currentPage} de {totalPages} ({totalItems} total)
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1.5 border rounded-lg text-sm ${
              currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Proxima
        </button>
      </div>
    </div>
  );
}
