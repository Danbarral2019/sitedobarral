import Image from 'next/image';
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
 className="block bg-surface-page rounded-md border border-border-subtle p-4 hover:border-border-strong transition-all group"
 >
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-[3px] bg-surface-raised text-ink-secondary flex-shrink-0">
 {site.faviconUrl ? (
 <Image src={site.faviconUrl} alt="" width={20} height={20} className="rounded" unoptimized />
 ) : (
 <Globe className="w-5 h-5" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <h4 className="font-semibold text-ink-primary text-sm group-hover:text-ink-secondary transition-colors">
 {highlightText(site.title, query)}
 </h4>
 <ExternalLink className="w-3.5 h-3.5 text-ink-muted" />
 </div>
 <p className="text-sm text-ink-secondary mt-1 line-clamp-2">
 {highlightText(site.description, query)}
 </p>
 {site.category && (
 <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-raised text-ink-secondary">
 {site.category}
 </span>
 )}
 </div>
 </div>
 </a>
 );
}
