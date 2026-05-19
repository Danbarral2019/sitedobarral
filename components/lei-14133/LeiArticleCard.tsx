'use client';

import { normalizeTextContent } from '@/lib/utils';
import { EmentaParagraph } from '@/components/lei-14133/EmentaParagraph';
import { getArticleStatus, type ArticleStatusVariant } from '@/lib/lei-14133/article-status';

interface LeiArticleCardProps {
  numero: string;
  titulo: string | null;
  capituloCompleto: string | null;
  ementa: string;
  documentCount: number;
  statusVariant?: ArticleStatusVariant;
}

export function LeiArticleCard({
  numero,
  titulo,
  capituloCompleto,
  ementa,
  documentCount,
  statusVariant = 'reader',
}: LeiArticleCardProps) {
  const status = getArticleStatus(documentCount, statusVariant);
  const Icon = status.icon;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg">
              Artigo {numero}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${status.color} flex items-center gap-1`}
            >
              <Icon className="w-3 h-3" />
              {status.label}
            </span>
          </div>
          {titulo && <p className="text-sm text-gray-600 mb-1">{titulo}</p>}
          {capituloCompleto && <p className="text-sm text-gray-600 mb-2">{capituloCompleto}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-blue-600">{documentCount}</p>
          <p className="text-sm text-gray-600">documentos</p>
        </div>
      </div>

      <div className="prose max-w-none">
        <div className="space-y-2">
          {normalizeTextContent(ementa).map((p, i) => (
            <EmentaParagraph key={i} text={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
