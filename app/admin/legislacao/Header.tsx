'use client';

/**
 * Header da página de Legislação (Client Component)
 */

import Link from 'next/link';

export function LegislacaoHeader() {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Atos Normativos</h1>
          <p className="text-gray-600">Leis, decretos, portarias e instruções normativas</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/legislacao/importar"
            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 13H7v-2h6v2zm3-4H7v-2h9v2zm0-4H7V5h9v2z" />
            </svg>
            Importar Excel
          </Link>
          <Link
            href="/admin/legislacao/new"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Ato
          </Link>
        </div>
      </div>
    </div>
  );
}
