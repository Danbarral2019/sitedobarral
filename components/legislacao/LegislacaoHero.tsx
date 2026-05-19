'use client';

import { Scale, Lightbulb, Monitor, FileText } from 'lucide-react';
import type { LegislacaoTab, LegislacaoTheme } from '@/lib/legislacao/theme';

interface LegislacaoHeroProps {
  tab: LegislacaoTab;
  theme: LegislacaoTheme;
}

function HeroIcon({ tab }: { tab: LegislacaoTab }) {
  const iconClass = 'w-10 h-10 text-white';
  if (tab === 'orientacoes') return <Lightbulb className={iconClass} />;
  if (tab === 'tic') return <Monitor className={iconClass} />;
  if (tab === 'boas-praticas') return <FileText className={iconClass} />;
  return <Scale className={iconClass} />;
}

export function LegislacaoHero({ tab, theme }: LegislacaoHeroProps) {
  return (
    <section className={`bg-gradient-to-r ${theme.heroGradient} text-white py-16 transition-colors duration-300`}>
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
            <HeroIcon tab={tab} />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">{theme.pageTitle}</h1>
            <p className={`text-xl ${theme.heroSubtitle}`}>{theme.pageDescription}</p>
          </div>
        </div>
        <p className={`text-lg ${theme.heroSubtitle} max-w-3xl`}>{theme.pageLongDescription}</p>
      </div>
    </section>
  );
}
