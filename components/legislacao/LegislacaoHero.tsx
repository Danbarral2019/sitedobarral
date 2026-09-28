'use client';

import type { LegislacaoTheme } from '@/lib/legislacao/theme';

interface LegislacaoHeroProps {
  theme: LegislacaoTheme;
}

export function LegislacaoHero({ theme }: LegislacaoHeroProps) {
  return (
    <section className={`${theme.heroGradient} text-white py-10 md:py-12`}>
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-3xl md:text-4xl font-bold">{theme.pageTitle}</h1>
        <p className={`text-lg mt-2 ${theme.heroSubtitle}`}>{theme.pageDescription}</p>
        <p className={`mt-3 ${theme.heroSubtitle} max-w-3xl`}>{theme.pageLongDescription}</p>
      </div>
    </section>
  );
}
