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
      className={`border-2 rounded-xl overflow-hidden transition-all ${
        isBoasPraticas
          ? 'border-gray-200 hover:border-emerald-300'
          : 'border-gray-200 hover:border-amber-300'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${TYPE_COLORS[act.type] || 'bg-gray-100 text-gray-800'}`}>
                {TYPE_LABELS[act.type] || act.type}
              </span>
              {act.esfera && (
                <span className="px-1.5 py-0.5 text-xs font-medium rounded border flex items-center gap-0.5 bg-gray-50 text-gray-600 border-gray-200">
                  <Globe className="w-3 h-3" />
                  {ESFERA_LABELS[act.esfera] || act.esfera}
                </span>
              )}
              {act.fullNumber && (
                <Link
                  href={`/legislacao/${act.id}`}
                  className="text-sm font-mono font-bold text-gray-900 hover:text-amber-700 transition-colors"
                >
                  {act.fullNumber}
                </Link>
              )}
            </div>

            {/* Titulo */}
            <h3 className="font-bold text-gray-900 text-base leading-tight">
              <Link
                href={`/legislacao/${act.id}`}
                className="hover:text-amber-700 transition-colors"
              >
                {act.title}
              </Link>
            </h3>

            {/* Ementa */}
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {act.ementa}
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5" />
                {act.issuer}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(act.publishDate)}
              </span>
              {act.leiArticles && act.leiArticles.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
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
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
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
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isBoasPraticas
                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
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
        <div className="border-t-2 border-gray-100 bg-gray-50 p-4">
          {/* Resumo Didatico */}
          {act.summary && (
            <div className={`mb-4 rounded-lg overflow-hidden ${
              isBoasPraticas ? 'bg-emerald-50' : 'bg-blue-50'
            }`}>
              <div className={`px-3 py-2 ${
                isBoasPraticas
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600'
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
              <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                Artigos da Lei 14.133/2021
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {act.leiArticles.map(art => (
                  <span
                    key={art}
                    className="px-2.5 py-1 bg-blue-100 text-blue-900 text-xs font-semibold rounded-lg border border-blue-300"
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
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg transition-colors ${
                  isBoasPraticas
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
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
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
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
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
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
