'use client';

import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';

export function LegislacaoHighlightCard() {
  return (
    <section className="container mx-auto px-4 max-w-6xl mt-8">
      <Link href="/lei-14133" className="block group">
        <div className="relative overflow-hidden rounded-md bg-surface-raised p-8 md:p-10 hover:shadow-2xl transition-all border-2 border-brand-500/30">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0yNCAzOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
          <div className="relative flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-surface-page/20 rounded-md flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-9 h-9 text-surface-page" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold text-surface-page mb-1">
                Lei 14.133/2021 — Comentada
              </h2>
              <p className="text-lg text-surface-page/80">195 artigos com jurisprudência e doutrina</p>
            </div>
            <span className="inline-flex items-center gap-2 bg-surface-page text-brand-700 px-8 py-4 rounded-md text-lg font-bold group-hover:bg-surface-raised transition-colors flex-shrink-0">
              Acessar Lei Comentada
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}
