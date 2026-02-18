'use client';

import { useState } from 'react';
import { Scale, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function LeiQuickAccess() {
  const router = useRouter();
  const [articleInput, setArticleInput] = useState('');

  return (
    <div className="bg-brand-50/50 border border-brand-200 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Scale className="w-5 h-5 text-brand-600" />
          <div>
            <h3 className="font-serif text-brand-800 font-bold">Lei 14.133/2021</h3>
            <p className="text-sm text-brand-600">195 artigos comentados</p>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num = articleInput.trim();
              if (num && /^\d+$/.test(num)) {
                router.push(`/area-restrita/artigo/${num}`);
              }
            }}
            className="flex gap-2 flex-1"
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Ir para Art. ..."
              value={articleInput}
              onChange={(e) => setArticleInput(e.target.value.replace(/\D/g, ''))}
              className="flex-1 max-w-[160px] px-3 py-2 bg-white border border-brand-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="submit"
              disabled={!articleInput.trim()}
              className="px-3 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <Link
            href="/area-restrita/lei-comentada"
            className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors whitespace-nowrap hidden sm:inline-flex items-center gap-1"
          >
            Explorar por Temas &rarr;
          </Link>
        </div>
      </div>

      <Link
        href="/area-restrita/lei-comentada"
        className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors mt-3 inline-flex items-center gap-1 sm:hidden"
      >
        Explorar por Temas &rarr;
      </Link>
    </div>
  );
}
