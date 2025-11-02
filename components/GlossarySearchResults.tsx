import Link from 'next/link';
import { BookOpen, ExternalLink } from 'lucide-react';
import type { GlossaryTermType } from '@/hooks/use-search';

interface GlossarySearchResultsProps {
  terms: GlossaryTermType[];
  searchQuery: string;
}

export function GlossarySearchResults({ terms, searchQuery }: GlossarySearchResultsProps) {
  if (terms.length === 0) {
    return null;
  }

  // Função para destacar o termo buscado
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 font-semibold">{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-bold text-gray-900">
          Glossário
        </h3>
        <span className="text-sm text-gray-500">
          ({terms.length} {terms.length === 1 ? 'termo encontrado' : 'termos encontrados'})
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200">
        {terms.map((term) => (
          <Link
            key={term.id}
            href={`/glossario/${term.slug}`}
            className="block p-4 hover:bg-purple-50 transition-colors duration-150"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 mb-1">
                  <h4 className="text-base font-bold text-gray-900 hover:text-purple-600">
                    {highlightMatch(term.term, searchQuery)}
                  </h4>
                  {term.category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                      {term.category}
                    </span>
                  )}
                </div>

                {term.shortDef ? (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {highlightMatch(term.shortDef, searchQuery)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {highlightMatch(term.definition.substring(0, 150), searchQuery)}...
                  </p>
                )}
              </div>

              <ExternalLink className="h-4 w-4 text-purple-600 flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-3 text-sm text-gray-600 text-center">
        <Link
          href="/glossario"
          className="text-purple-600 hover:text-purple-800 font-medium"
        >
          Ver glossário completo →
        </Link>
      </div>
    </div>
  );
}
