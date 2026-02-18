/** @deprecated Replaced by LeiQuickAccess (2026-02-18) */
'use client';

import { useState } from 'react';
import { Scale, Search, ArrowRight, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LeiHighlightCardProps {
  onExploreTemas: () => void;
}

export function LeiHighlightCard({ onExploreTemas }: LeiHighlightCardProps) {
  const router = useRouter();
  const [articleInput, setArticleInput] = useState('');

  return (
    <div className="mb-6 bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-4 text-white shadow-lg overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <Scale className="w-full h-full" />
      </div>

      <div className="relative z-10">
        {/* Single-row layout: icon + title + input + button */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2 bg-white/20 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
            <div className="sm:mr-2">
              <h2 className="text-base lg:text-lg font-bold leading-tight">Lei 14.133/2021 Comentada</h2>
              <p className="text-xs text-brand-200">195 artigos com jurisprudência</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num = articleInput.trim();
              if (num && /^\d+$/.test(num)) {
                router.push(`/area-restrita/artigo/${num}`);
              }
            }}
            className="flex-1 flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-300" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ir para Art. ..."
                value={articleInput}
                onChange={(e) => setArticleInput(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-9 pr-3 py-2 bg-white/15 border border-white/20 rounded-xl text-white placeholder-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/20"
              />
            </div>
            <button
              type="submit"
              disabled={!articleInput.trim()}
              className="px-3 py-2 bg-white text-brand-700 font-bold text-sm rounded-xl hover:bg-brand-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <button
            onClick={onExploreTemas}
            className="flex-shrink-0 px-4 py-2 bg-white/15 border border-white/25 text-white font-semibold text-sm rounded-xl hover:bg-white/25 transition-colors flex items-center gap-2 justify-center"
          >
            Explorar por Temas
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
