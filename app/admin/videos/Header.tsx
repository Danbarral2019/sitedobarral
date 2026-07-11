'use client';

/**
 * Header da página de Vídeos (Client Component)
 */

import Link from 'next/link';

export function VideosHeader() {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Vídeos do YouTube</h1>
          <p className="text-gray-600">Gerenciar vídeos dos cursos</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/videos/new"
            className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:from-red-700 hover:to-pink-700 transition-all shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Vídeo
          </Link>
          <Link
            href="/admin/videos/upload"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center gap-2"
          >
            Upload de vídeo (R2)
          </Link>
        </div>
      </div>
    </div>
  );
}
