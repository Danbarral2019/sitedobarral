import Link from 'next/link';
import { Eye, ExternalLink } from 'lucide-react';

interface GlossaryTermCardProps {
  term: {
    id: string;
    term: string;
    slug: string;
    shortDef?: string | null;
    category?: string | null;
    viewCount: number;
  };
}

export function GlossaryTermCard({ term }: GlossaryTermCardProps) {
  return (
    <Link
      href={`/glossario/${term.slug}`}
      className="block bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-blue-300 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600">
          {term.term}
        </h3>
        {term.category && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {term.category}
          </span>
        )}
      </div>

      {term.shortDef && (
        <p className="text-gray-600 text-sm line-clamp-2 mb-3">
          {term.shortDef}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          <span>{term.viewCount} visualizações</span>
        </div>
        <div className="flex items-center gap-1 text-blue-600 font-medium">
          Ver detalhes
          <ExternalLink className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}
