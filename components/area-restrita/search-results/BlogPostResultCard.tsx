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
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-orange-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-orange-50 text-orange-600 flex-shrink-0">
          <Newspaper className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm group-hover:text-orange-600 transition-colors">
            {highlightText(post.title, query)}
          </h4>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {highlightText(post.excerpt, query)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
              {post.author}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
