'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
}: PaginationProps) {
  // Validate and sanitize inputs to prevent NaN
  const safeTotalItems = Number.isFinite(totalItems) ? totalItems : 0;
  const safeItemsPerPage = Number.isFinite(itemsPerPage) && itemsPerPage > 0 ? itemsPerPage : 1;
  const safeCurrentPage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  const safeTotalPages = Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;

  const startItem = (safeCurrentPage - 1) * safeItemsPerPage + 1;
  const endItem = Math.min(safeCurrentPage * safeItemsPerPage, safeTotalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];

    if (safeTotalPages <= 7) {
      // Mostrar todas as páginas se forem 7 ou menos
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      // Sempre mostrar primeira página
      pages.push(1);

      if (safeCurrentPage > 3) {
        pages.push('...');
      }

      // Mostrar páginas ao redor da atual
      for (let i = Math.max(2, safeCurrentPage - 1); i <= Math.min(safeTotalPages - 1, safeCurrentPage + 1); i++) {
        pages.push(i);
      }

      if (safeCurrentPage < safeTotalPages - 2) {
        pages.push('...');
      }

      // Sempre mostrar última página
      pages.push(safeTotalPages);
    }

    return pages;
  };

  if (safeTotalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-gray-200">
      <div className="text-sm text-gray-700">
        Mostrando <span className="font-medium">{String(startItem)}</span> a{' '}
        <span className="font-medium">{String(endItem)}</span> de{' '}
        <span className="font-medium">{String(safeTotalItems)}</span> resultados
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-3 py-2 text-gray-500">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(page as number)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all ${
                    safeCurrentPage === page
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {String(page)}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === safeTotalPages}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          Próxima
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
