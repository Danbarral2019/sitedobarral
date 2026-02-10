'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  FileText,
  BookOpen,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Gavel,
  Loader2,
} from 'lucide-react';

interface RecentDocument {
  id: string;
  title: string;
  category: string;
  type: string;
  uploadedAt: string;
}

interface RecentBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt: string;
}

interface DocumentUpdate {
  id: string;
  documentId: string;
  changeType: string;
  changesSummary?: string | null;
  detectedAt: string;
  documentTitle: string;
  documentCategory: string;
}

interface PlatformUpdate {
  id: string;
  title: string;
  description: string;
  date: string;
  type: string;
}

interface NovidadesData {
  recentDocuments: RecentDocument[];
  recentBlogPosts: RecentBlogPost[];
  documentUpdates: DocumentUpdate[];
  platformUpdates: PlatformUpdate[];
}

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  acordao: Gavel,
  'manual-tcu': BookOpen,
  default: FileText,
};

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atras`;
  if (diffDays < 14) return '1 semana atras';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atras`;
  return `${Math.floor(diffDays / 30)} mes(es) atras`;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    acordao: 'Acordao TCU',
    'manual-tcu': 'Manual TCU',
    'parecer-vinculante': 'Parecer Vinculante',
    'orientacao-normativa': 'ON',
    enunciados: 'Enunciado',
    decor: 'DECOR',
    'lei-artigo': 'Lei 14.133',
    'ato-normativo': 'Ato Normativo',
  };
  return labels[category] || 'Documento';
}

interface NovidadesSectionProps {
  onDocumentClick?: (documentId: string) => void;
}

export default function NovidadesSection({ onDocumentClick }: NovidadesSectionProps) {
  const [data, setData] = useState<NovidadesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/area-restrita/novidades')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando novidades...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasContent =
    data.recentDocuments.length > 0 ||
    data.recentBlogPosts.length > 0 ||
    data.documentUpdates.length > 0;

  if (!hasContent && data.platformUpdates.length === 0) return null;

  // Merge all items into a unified timeline
  const timelineItems: Array<{
    id: string;
    type: 'document' | 'blog' | 'update' | 'platform';
    title: string;
    subtitle?: string;
    date: string;
    href?: string;
    documentId?: string;
  }> = [];

  for (const doc of data.recentDocuments.slice(0, isExpanded ? 8 : 3)) {
    timelineItems.push({
      id: `doc-${doc.id}`,
      type: 'document',
      title: doc.title,
      subtitle: getCategoryLabel(doc.category),
      date: doc.uploadedAt,
      documentId: doc.id,
    });
  }

  for (const post of data.recentBlogPosts) {
    timelineItems.push({
      id: `blog-${post.id}`,
      type: 'blog',
      title: post.title,
      subtitle: post.excerpt?.slice(0, 80) || undefined,
      date: post.publishedAt,
      href: `/blog/${post.slug}`,
    });
  }

  for (const upd of data.documentUpdates.slice(0, 3)) {
    timelineItems.push({
      id: `upd-${upd.id}`,
      type: 'update',
      title: upd.documentTitle,
      subtitle: upd.changesSummary || `${upd.changeType === 'new' ? 'Nova versao' : 'Atualizado'}`,
      date: upd.detectedAt,
      documentId: upd.documentId,
    });
  }

  // Sort by date desc
  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const visibleItems = timelineItems.slice(0, isExpanded ? 10 : 4);
  const hasMore = timelineItems.length > 4;

  return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg">
            <Bell className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Novidades</h3>
          {timelineItems.length > 0 && (
            <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
              {timelineItems.length}
            </span>
          )}
        </div>
        {data.platformUpdates.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-purple-600 font-semibold">
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">Novas funcionalidades</span>
          </div>
        )}
      </div>

      {/* Platform updates banner */}
      {data.platformUpdates.length > 0 && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 border-b border-gray-100">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {data.platformUpdates.map((pu) => (
              <span
                key={pu.id}
                className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-100/60 px-2.5 py-1 rounded-full"
                title={pu.description}
              >
                <Sparkles className="w-3 h-3" />
                {pu.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline items */}
      {visibleItems.length > 0 && (
        <div className="divide-y divide-gray-50">
          {visibleItems.map((item) => {
            const IconComp =
              item.type === 'blog'
                ? BookOpen
                : item.type === 'update'
                ? RefreshCw
                : CATEGORY_ICONS.default;

            const colorClass =
              item.type === 'blog'
                ? 'text-emerald-500 bg-emerald-50'
                : item.type === 'update'
                ? 'text-amber-500 bg-amber-50'
                : 'text-brand-500 bg-brand-50';

            const isClickable = !!(item.href || item.documentId);

            const content = (
              <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors group ${isClickable ? 'hover:bg-gray-50 cursor-pointer' : ''}`}>
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}>
                  <IconComp className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium text-gray-800 truncate ${isClickable ? 'group-hover:text-brand-600' : ''} transition-colors`}>
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">
                  {getRelativeDate(item.date)}
                </span>
                {isClickable && (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                )}
              </div>
            );

            if (item.href) {
              return (
                <Link key={item.id} href={item.href}>
                  {content}
                </Link>
              );
            }

            if (item.documentId && onDocumentClick) {
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onDocumentClick(item.documentId!)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDocumentClick(item.documentId!); } }}
                >
                  {content}
                </div>
              );
            }

            return <div key={item.id}>{content}</div>;
          })}
        </div>
      )}

      {/* Show more / less */}
      {hasMore && (
        <div className="px-4 py-2 border-t border-gray-100">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            {isExpanded ? 'Mostrar menos' : `Ver todas as ${timelineItems.length} novidades`}
          </button>
        </div>
      )}

      {/* Empty state */}
      {visibleItems.length === 0 && data.platformUpdates.length === 0 && (
        <div className="px-4 py-6 text-center">
          <Bell className="w-6 h-6 text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Nenhuma novidade recente</p>
        </div>
      )}
    </div>
  );
}
