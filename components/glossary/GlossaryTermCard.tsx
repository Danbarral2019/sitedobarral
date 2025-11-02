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
      className="block p-5 hover:bg-blue-50 transition-colors duration-150"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 mb-1">
            <h3 className="text-lg font-bold text-gray-900 hover:text-blue-600">
              {term.term}
            </h3>
            {term.category && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                {term.category}
              </span>
            )}
          </div>

          {term.shortDef && (
            <p className="text-gray-600 text-sm line-clamp-1">
              {term.shortDef}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{term.viewCount}</span>
          </div>
          <ExternalLink className="h-4 w-4 text-blue-600" />
        </div>
      </div>
    </Link>
  );
}
