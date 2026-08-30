'use client';

import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Building,
  Calendar,
  Eye,
  Scale,
  BookOpen,
  ExternalLink,
  Download,
  Globe,
} from 'lucide-react';
import MarkdownContent from '@/components/MarkdownContent';
import { getTypeLabel, getTypeColor, getEsferaLabel, formatLegislativeDate } from '@/lib/legislacao/labels';
import { getThemeLabel } from '@/data/temas-licitacoes';
import { getHierarchyInfo } from '@/lib/legislative-acts/hierarchy';
import type { LegislativeAct } from '@/hooks/use-legislacao';
import type { LegislacaoTheme } from '@/lib/legislacao/theme';

interface LegislativeActCardProps {
  act: LegislativeAct;
  theme: LegislacaoTheme;
  isExpanded: boolean;
  onToggle: () => void;
  tabIsBoasPraticasOrOrientacoes: boolean;
}

export function LegislativeActCard({
  act,
  theme,
  isExpanded,
  onToggle,
  tabIsBoasPraticasOrOrientacoes,
}: LegislativeActCardProps) {
  const lvl = act.hierarchyLevel;
  const lvlMeta = getHierarchyInfo(lvl);
  const typeTooltip = lvlMeta ? `${getTypeLabel(act.type)} — nível ${lvl} (${lvlMeta.description})` : getTypeLabel(act.type);

  return (
    <article
      id={act.id}
      className={`bg-surface-page border-2 rounded-md overflow-hidden transition-all border-border-subtle ${theme.cardHoverBorder}`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`px-3 py-1 text-sm font-bold rounded-[3px] border-2 ${getTypeColor(act.type)}`} title={typeTooltip}>
                {getTypeLabel(act.type)}
              </span>
              {act.hierarchyLevel && (
                <span
                  className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded text-ink-secondary bg-surface-deep border border-border-subtle"
                  title={`Nível hierárquico ${act.hierarchyLevel} — ${lvlMeta?.description ?? ''}`}
                >
                  nv. {act.hierarchyLevel}
                </span>
              )}
              {act.esfera && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded border flex items-center gap-1 bg-surface-deep text-ink-secondary border-border-strong">
                  <Globe className="w-3 h-3" />
                  {getEsferaLabel(act.esfera)}
                </span>
              )}
              {act.fullNumber && (
                <Link
                  href={`/legislacao/${act.id}`}
                  className="text-lg font-mono font-bold text-ink-primary hover:text-brand-700 transition-colors"
                >
                  {act.fullNumber}
                </Link>
              )}
            </div>

            <h2 className="text-2xl font-bold text-ink-primary mb-2 leading-tight">
              <Link href={`/legislacao/${act.id}`} className="hover:text-brand-700 transition-colors">
                {act.title}
              </Link>
            </h2>

            <p className="text-ink-secondary leading-relaxed mb-4">{act.ementa}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-ink-secondary">
              <div className="flex items-center gap-1.5">
                <Building className="w-4 h-4" />
                {act.issuer}
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatLegislativeDate(act.publishDate)}
              </div>
              {act.viewCount !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  {act.viewCount} visualizações
                </div>
              )}
            </div>

            {act.themes && act.themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {act.themes.map((t) => (
                  <span key={t} className={`px-2 py-0.5 text-xs rounded-full ${theme.themeChip}`}>
                    {getThemeLabel(t)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onToggle}
            className="flex-shrink-0 p-3 text-ink-secondary hover:bg-surface-deep rounded-[3px] transition-colors"
            aria-label="Ver mais detalhes"
          >
            {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
          </button>
        </div>

        {act.leiArticles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink-secondary flex items-center gap-1">
              <Scale className="w-4 h-4" />
              Artigos:
            </span>
            {act.leiArticles.slice(0, 5).map((art) => (
              <span
                key={art}
                className="px-2 py-0.5 bg-surface-raised text-ink-primary text-xs font-semibold rounded border border-border-subtle"
              >
                Art. {art}
              </span>
            ))}
            {act.leiArticles.length > 5 && (
              <span className="text-xs text-ink-muted">+{act.leiArticles.length - 5} artigos</span>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="border-t-2 border-border-subtle bg-surface-raised p-6">
          {act.summary && (
            <div className={`mb-6 rounded-md overflow-hidden ${theme.summaryGradient}`}>
              <div className={`px-4 py-3 ${theme.summaryHeader}`}>
                <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wide">
                  <BookOpen className="w-5 h-5" />
                  Resumo Didático
                </h3>
              </div>
              <div className="p-4">
                <MarkdownContent content={act.summary} />
              </div>
            </div>
          )}

          {act.leiArticles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-ink-secondary mb-3 uppercase tracking-wide">
                Artigos Regulamentados da Lei 14.133/2021
              </h3>
              <div className="flex flex-wrap gap-2">
                {act.leiArticles.map((art) => (
                  <span
                    key={art}
                    className="px-3 py-1.5 bg-surface-deep text-ink-primary text-sm font-semibold rounded-[3px] border-2 border-border-strong"
                  >
                    Art. {art}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {act.officialUrl && (
              <a
                href={act.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-4 py-2.5 text-white rounded-[3px] transition-colors font-semibold ${theme.primaryActionBg}`}
              >
                <ExternalLink className="w-5 h-5" />
                {tabIsBoasPraticasOrOrientacoes ? 'Ver Fonte Original' : 'Ver Texto Oficial'}
              </a>
            )}
            {act.pdfUrl && (
              <a
                href={act.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-[3px] hover:bg-brand-700 transition-colors font-semibold"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </a>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
