'use client';

interface LegislacaoPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

export function LegislacaoPagination({ page, totalPages, onPageChange }: LegislacaoPaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-12 flex justify-center items-center gap-2">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-6 py-3 border-2 border-border-strong rounded-[3px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-raised transition-colors"
      >
        ← Anterior
      </button>
      <span className="px-6 py-3 text-ink-secondary font-semibold">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="px-6 py-3 border-2 border-border-strong rounded-[3px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-raised transition-colors"
      >
        Próxima →
      </button>
    </div>
  );
}
