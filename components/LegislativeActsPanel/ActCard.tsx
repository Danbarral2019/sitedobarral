'use client';

import {
  ExternalLink, ChevronDown, ChevronUp,
  Globe, Building, Calendar, BookOpen, Download,
} from 'lucide-react';
import Link from 'next/link';
import { getThemeLabel } from '@/data/temas-licitacoes';
import MarkdownContent from '@/components/MarkdownContent';
import { TYPE_LABELS, TYPE_COLORS, ESFERA_LABELS } from './constants';
import type { LegislativeAct } from './constants';

interface ActCardProps {
  act: LegislativeAct;
  expandedAct: string | null;
  setExpandedAct: (id: string | null) => void;
  isBoasPraticas: boolean;
  formatDate: (dateStr: string) => string;
}

export default function ActCard({ act, expandedAct, setExpandedAct, isBoasPraticas, formatDate }: ActCardProps) {
  return (
    <div
      className={`border-2 rounded-[6px] overflow-hidden transition-all ${
        isBoasPraticas
          ? 'border-border-subtle hover:border-emerald-300'
          : 'border-border-subtle hover:border-amber-accent'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${TYPE_COLORS[act.type] || 'bg-surface-deep text-ink-secondary'}`}>
                {TYPE_LABELS[act.type] || act.type}
              </span>
              {act.esfera && (
                <span className="px-1.5 py-0.5 text-xs font-medium rounded border flex items-center gap-0.5 bg-surface-raised text-ink-muted border-border-subtle">
                  <Globe className="w-3 h-3" />
                  {ESFERA_LABELS[act.esfera] || act.esfera}
                </span>
              )}
              {act.fullNumber && (
                <Link
                  href={`/legislacao/${act.id}`}
                  className="text-sm font-mono font-bold text-ink-primary hover:text-amber-accent-deep transition-colors"
                >
                  {act.fullNumber}
                </Link>
              )}
            </div>

            {/* Titulo */}
            <h3 className="font-bold text-ink-primary text-base leading-tight">
              <Link
                href={`/legislacao/${act.id}`}
                className="hover:text-amber-accent-deep transition-colors"
              >
                {act.title}
              </Link>
            </h3>

            {/* Ementa */}
            <p className="text-sm text-ink-muted mt-1 line-clamp-2">
              {act.ementa}
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-ink-muted">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5" />
                {act.issuer}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(act.publishDate)}
              </span>
              {act.leiArticles && act.leiArticles.length > 0 && (
                <span className="px-2 py-0.5 rounded-[3px] bg-brand-50 text-brand-700 font-medium">
                  Art. {act.leiArticles.slice(0, 4).join(', ')}{act.leiArticles.length > 4 ? '...' : ''}
                </span>
              )}
            </div>

            {/* Temas mini-pills */}
            {act.themes && act.themes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {act.themes.map(t => (
                  <span
                    key={t}
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      isBoasPraticas
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-brand-50 text-brand-700 border border-brand-200'
                    }`}
                  >
                    {getThemeLabel(t)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Expand + Links */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={() => setExpandedAct(expandedAct === act.id ? null : act.id)}
              className="p-2 text-ink-muted hover:text-ink-secondary hover:bg-surface-deep rounded-[6px] transition-colors"
              aria-label="Ver detalhes"
            >
              {expandedAct === act.id
                ? <ChevronUp className="w-5 h-5" />
                : <ChevronDown className="w-5 h-5" />}
            </button>
            {(act.officialUrl || act.url) && (
              <a
                href={act.officialUrl || act.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-[6px] transition-colors ${
                  isBoasPraticas
                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    : 'text-amber-accent-deep bg-amber-accent-soft hover:bg-amber-accent'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Texto
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Detalhes Expandidos */}
      {expandedAct === act.id && (
        <div className="border-t-2 border-border-subtle bg-surface-raised p-4">
          {/* Resumo Didatico */}
          {act.summary && (
            <div className={`mb-4 rounded-[6px] overflow-hidden ${
              isBoasPraticas ? 'bg-emerald-50' : 'bg-brand-50'
            }`}>
              <div className={`px-3 py-2 ${
                isBoasPraticas
                  ? 'bg-emerald-600'
                  : 'bg-brand-600'
              }`}>
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wide">
                  <BookOpen className="w-4 h-4" />
                  Resumo Didático
                </h4>
              </div>
              <div className="p-3 text-sm">
                <MarkdownContent content={act.summary} />
              </div>
            </div>
          )}

          {/* Artigos */}
          {act.leiArticles && act.leiArticles.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-ink-muted mb-2 uppercase tracking-wide">
                Artigos da Lei 14.133/2021
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {act.leiArticles.map(art => (
                  <span
                    key={art}
                    className="px-2.5 py-1 bg-brand-100 text-brand-900 text-xs font-semibold rounded-[6px] border border-brand-300"
                  >
                    Art. {art}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-wrap gap-2">
            {act.officialUrl && (
              <a
                href={act.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-[6px] transition-colors ${
                  isBoasPraticas
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                {isBoasPraticas ? 'Ver Fonte Original' : 'Ver Texto Oficial'}
              </a>
            )}
            {act.url && act.url !== act.officialUrl && (
              <a
                href={act.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink-secondary bg-surface-deep rounded-[6px] hover:bg-border-strong transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Link DOU
              </a>
            )}
            {act.pdfUrl && (
              <a
                href={act.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink-secondary bg-surface-deep rounded-[6px] hover:bg-border-strong transition-colors"
              >
                <Download className="w-4 h-4" />
                PDF
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
