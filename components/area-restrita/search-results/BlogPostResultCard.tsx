import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import type { BlogPostResult } from '@/lib/types/global-search';
import { highlightText } from './search-utils';

export interface BlogPostResultCardProps {
  post: BlogPostResult;
  query: string;
}

export function BlogPostResultCard({ post, query }: BlogPostResultCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block bg-white rounded-[6px] border border-border-subtle p-4 hover:border-amber-accent hover: transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-[6px] bg-amber-accent-soft text-ink-primary flex-shrink-0">
          <Newspaper className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-ink-primary text-sm group-hover:text-amber-accent-deep transition-colors">
            {highlightText(post.title, query)}
          </h4>
          <p className="text-sm text-ink-muted mt-1 line-clamp-2">
            {highlightText(post.excerpt, query)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-[3px] text-xs font-medium bg-amber-accent-soft text-ink-primary">
              {post.author}
            </span>
            <span className="text-xs text-ink-muted">
              {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
