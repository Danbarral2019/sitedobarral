import { Globe, ExternalLink } from 'lucide-react';
import type { SiteResult } from '@/lib/types/global-search';
import { highlightText } from './search-utils';

export interface SiteResultCardProps {
  site: SiteResult;
  query: string;
}

export function SiteResultCard({ site, query }: SiteResultCardProps) {
  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-teal-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
          {site.faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.faviconUrl} alt="" className="w-5 h-5 rounded" />
          ) : (
            <Globe className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 text-sm group-hover:text-teal-600 transition-colors">
              {highlightText(site.title, query)}
            </h4>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {highlightText(site.description, query)}
          </p>
          {site.category && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
              {site.category}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
