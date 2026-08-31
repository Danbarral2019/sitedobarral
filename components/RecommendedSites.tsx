'use client';

import { ExternalLink, Globe, Scale, Gavel, BookOpen, Shield, ShoppingCart, DollarSign, Eye, GraduationCap, Globe2 } from 'lucide-react';

interface RecommendedSite {
  id: string;
  title: string;
  description: string;
  url: string;
  faviconUrl?: string | null;
  category?: string | null;
}

interface RecommendedSitesProps {
  sites: RecommendedSite[];
  compact?: boolean;
}

// Category display config with icons and colors
const CATEGORY_CONFIG: Record<string, { icon: typeof Globe; label: string; color: string; bg: string; border: string }> = {
  'Legislação': { icon: Scale, label: 'Legislação', color: 'text-brand-600', bg: 'bg-brand-50', border: 'border-brand-200' },
  'Jurisprudência': { icon: Gavel, label: 'Jurisprudência', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  'Doutrina e produção acadêmica': { icon: BookOpen, label: 'Doutrina e produção acadêmica', color: 'text-brand-600', bg: 'bg-brand-50', border: 'border-brand-200' },
  'Órgãos de controle e orientação normativa': { icon: Shield, label: 'Órgãos de controle e orientação normativa', color: 'text-brand-600', bg: 'bg-brand-50', border: 'border-brand-200' },
  'Sistemas e portais de compras': { icon: ShoppingCart, label: 'Sistemas e portais de compras', color: 'text-brand-600', bg: 'bg-brand-50', border: 'border-brand-200' },
  'Bases de preços e custos referenciais': { icon: DollarSign, label: 'Bases de preços e custos referenciais', color: 'text-amber-accent-deep', bg: 'bg-amber-accent-soft', border: 'border-amber-accent-soft' },
  'Transparência e dados abertos': { icon: Eye, label: 'Transparência e dados abertos', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Capacitação e comunidade': { icon: GraduationCap, label: 'Capacitação e comunidade', color: 'text-amber-accent-deep', bg: 'bg-amber-accent-soft', border: 'border-amber-accent-soft' },
  'Referências internacionais': { icon: Globe2, label: 'Referências internacionais', color: 'text-brand-600', bg: 'bg-brand-50', border: 'border-brand-200' },
};

// Desired category display order
const CATEGORY_ORDER = [
  'Legislação',
  'Jurisprudência',
  'Doutrina e produção acadêmica',
  'Órgãos de controle e orientação normativa',
  'Sistemas e portais de compras',
  'Bases de preços e custos referenciais',
  'Transparência e dados abertos',
  'Capacitação e comunidade',
  'Referências internacionais',
];

const DEFAULT_CONFIG = { icon: Globe, label: 'Outros', color: 'text-ink-muted', bg: 'bg-surface-raised', border: 'border-border-subtle' };

export default function RecommendedSites({ sites, compact }: RecommendedSitesProps) {
  if (!sites || sites.length === 0) {
    return null;
  }

  // Group sites by category
  const grouped: Record<string, RecommendedSite[]> = {};
  for (const site of sites) {
    const cat = site.category || 'Outros';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(site);
  }

  // Sort categories by desired order
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {!compact && (
          <div className="p-2.5 bg-brand-700 rounded-[6px] border border-border-subtle">
            <Globe className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
        )}
        <div className="flex items-center gap-2 flex-1">
          {compact && <Globe className="w-4 h-4 text-brand-500 flex-shrink-0" />}
          <div>
            <h2 className={compact ? 'text-sm font-bold text-ink-secondary' : 'text-lg lg:text-xl font-bold text-ink-primary'}>
              Sites de Interesse
            </h2>
            {!compact && (
              <p className="text-sm text-ink-muted">{sites.length} referências complementares para seus estudos</p>
            )}
          </div>
          {compact && (
            <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              {sites.length}
            </span>
          )}
        </div>
      </div>

      {/* Categories */}
      {sortedCategories.map((category) => {
        const config = CATEGORY_CONFIG[category] || DEFAULT_CONFIG;
        const Icon = config.icon;
        const categorySites = grouped[category];

        return (
          <div key={category} className={`rounded-[6px] border ${config.border} overflow-hidden`}>
            {/* Category header */}
            <div className={`flex items-center gap-2.5 px-4 py-3 ${config.bg}`}>
              <Icon className={`w-4.5 h-4.5 ${config.color}`} />
              <h3 className={`text-sm font-bold ${config.color}`}>{config.label}</h3>
              <span className={`text-xs font-semibold ${config.color} opacity-60`}>
                {categorySites.length}
              </span>
            </div>

            {/* Sites list */}
            <div className="bg-white divide-y divide-border-subtle">
              {categorySites.map((site) => (
                <a
                  key={site.id}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-raised transition-colors"
                >
                  {/* Favicon */}
                  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                    {site.faviconUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={site.faviconUrl}
                        alt=""
                        width={16}
                        height={16}
                        className="w-4 h-4"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.nextElementSibling) {
                            (target.nextElementSibling as HTMLElement).style.display = '';
                          }
                        }}
                      />
                    ) : null}
                    <Globe
                      className="w-4 h-4 text-ink-muted"
                      style={site.faviconUrl ? { display: 'none' } : undefined}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-ink-primary group-hover:text-brand-600 transition-colors truncate">
                        {site.title}
                      </h4>
                      <ExternalLink className="w-3 h-3 text-ink-muted group-hover:text-brand-500 flex-shrink-0 transition-colors" />
                    </div>
                    <p className="text-xs text-ink-muted truncate mt-0.5">
                      {site.description}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
