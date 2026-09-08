import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function markdownToPlainExcerpt(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atras`;
  if (diffDays < 14) return '1 semana atras';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atras`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    acordao: 'bg-brand-100 text-brand-700',
    'manual-tcu': 'bg-emerald-100 text-emerald-700',
    'orientacao-normativa': 'bg-brand-100 text-brand-700',
    enunciados: 'bg-amber-accent-soft text-amber-accent-deep',
    decor: 'bg-brand-100 text-brand-700',
    'parecer-vinculante': 'bg-rose-100 text-rose-700',
    'ato-normativo': 'bg-brand-100 text-brand-700',
    apostila: 'bg-brand-100 text-brand-700',
    sumula: 'bg-brand-100 text-brand-700',
    consulta_tcu: 'bg-brand-100 text-brand-700',
    informativo: 'bg-amber-accent-soft text-amber-accent-deep',
    'tribunal-tce-sp': 'bg-brand-100 text-brand-700',
    'tribunal-tce-pr': 'bg-brand-100 text-brand-700',
    'tribunal-tce-sc': 'bg-brand-100 text-brand-700',
    'tribunal-tce-rj': 'bg-brand-100 text-brand-700',
    'tribunal-tce-rs': 'bg-brand-100 text-brand-700',
    'tribunal-tce-pe': 'bg-brand-100 text-brand-700',
    'tribunal-stj': 'bg-brand-100 text-brand-700',
  };
  if (category.startsWith('tribunal-')) return 'bg-brand-100 text-brand-700';
  return colors[category] || 'bg-surface-deep text-ink-secondary';
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    acordao: 'Acordao TCU',
    'manual-tcu': 'Manual TCU',
    'orientacao-normativa': 'ON AGU',
    enunciados: 'Enunciado',
    decor: 'DECOR',
    'parecer-vinculante': 'Parecer',
    'ato-normativo': 'Ato Normativo',
    apostila: 'Apostila',
    sumula: 'Súmula TCU',
    consulta_tcu: 'Consulta TCU',
    informativo: 'Informativo TCU',
    'tribunal-tce-sp': 'TCE-SP',
    'tribunal-tce-pr': 'TCE-PR',
    'tribunal-tce-sc': 'TCE-SC',
    'tribunal-tce-rj': 'TCE-RJ',
    'tribunal-tce-rs': 'TCE-RS',
    'tribunal-tce-pe': 'TCE-PE',
    'tribunal-stj': 'STJ (DataJud)',
    'tribunal-tst': 'Súmula TST',
  };
  if (category.startsWith('tribunal-')) {
    return labels[category] || category.replace('tribunal-', '').toUpperCase();
  }
  return labels[category] || 'Documento';
}

export default async function HomeNovidadesSection() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let recentDocs: { id: string; title: string; category: string; uploadedAt: Date | null }[] = [];
  let blogPosts: { id: string; title: string; slug: string; excerpt: string | null; publishedAt: Date | null }[] = [];
  let tribunalDecisions: { id: string; title: string; tribunalCode: string; createdAt: Date }[] = [];

  try {
    [recentDocs, blogPosts, tribunalDecisions] = await Promise.all([
      prisma.document.findMany({
        where: {
          uploadedAt: { gte: thirtyDaysAgo },
          isPublic: true,
          reviewed: true,
          // Acórdãos e manual TCU são canônicos em TribunalDecision/categoria própria
          NOT: { category: { in: ['manual-tcu', 'acordao'] } },
        },
        select: {
          id: true,
          title: true,
          category: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: 'desc' },
        take: 10,
      }),
      prisma.blogPost.findMany({
        where: {
          isPublished: true,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: 4,
      }),
      prisma.tribunalDecision.findMany({
        where: {
          approvalStatus: { in: ['auto_approved', 'manually_approved'] },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          id: true,
          title: true,
          tribunalCode: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
  } catch {
    // DB unavailable (e.g. CI build) — render nothing
  }

  // Merge documents + tribunal decisions into a unified list sorted by date
  const allRecentItems: { id: string; title: string; category: string; date: Date; href: string }[] = [];

  for (const doc of recentDocs) {
    allRecentItems.push({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      date: doc.uploadedAt ?? new Date(),
      href: '/login',
    });
  }

  for (const td of tribunalDecisions) {
    allRecentItems.push({
      id: td.id,
      title: td.title,
      category: `tribunal-${td.tribunalCode}`,
      date: td.createdAt,
      href: '/jurisprudencia',
    });
  }

  allRecentItems.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Dedup por título normalizado — defesa caso o mesmo conteúdo apareça
  // em Document e TribunalDecision (caso histórico do TCU). Mantém a entrada
  // mais recente (primeira após sort desc).
  const seen = new Set<string>();
  const deduped = allRecentItems.filter((item) => {
    const key = item.title.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const visibleItems = deduped.slice(0, 10);

  const hasContent = visibleItems.length > 0 || blogPosts.length > 0;
  if (!hasContent) return null;

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-ink-primary mb-2">Novidades</h2>
            <div className="h-1 w-24 bg-brand-500 rounded-full mx-auto"></div>
            <p className="text-ink-muted mt-3">Últimas atualizações de conteúdo e materiais</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Blog posts — coluna maior */}
            {blogPosts.length > 0 && (
              <div className="lg:col-span-3">
                <h3 className="text-sm font-bold text-ink-muted uppercase tracking-wider mb-4">
                  Blog
                </h3>
                <div className="space-y-4">
                  {blogPosts.map((post, index) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      className={`block bg-white rounded-[6px] border border-border-subtle hover:border-brand-300 hover: transition-all group ${
                        index === 0 ? 'p-6' : 'p-5'
                      }`}
                    >
                      <p className={`font-semibold text-ink-primary group-hover:text-brand-600 transition-colors line-clamp-2 ${
                        index === 0 ? 'text-lg' : 'text-base'
                      }`}>
                        {post.title}
                      </p>
                      {post.excerpt && (
                        <p className={`text-ink-muted mt-2 ${
                          index === 0 ? 'text-sm line-clamp-3' : 'text-sm line-clamp-2'
                        }`}>{markdownToPlainExcerpt(post.excerpt)}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-ink-muted">
                          {post.publishedAt
                            ? getRelativeDate(new Date(post.publishedAt))
                            : ''}
                        </span>
                        <span className="text-xs font-semibold text-brand-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Ler <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-4">
                  <Link
                    href="/blog"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    Ver todos no Blog
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Recent content — lista compacta */}
            {visibleItems.length > 0 && (
              <div className={blogPosts.length > 0 ? 'lg:col-span-2' : 'lg:col-span-5'}>
                <h3 className="text-sm font-bold text-ink-muted uppercase tracking-wider mb-4">
                  Conteúdo Recente
                </h3>
                <div className="space-y-2">
                  {visibleItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block bg-white rounded-[6px] border border-border-subtle hover:border-brand-300 hover: px-4 py-3 flex items-center gap-3 transition-all group"
                    >
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getCategoryColor(item.category)}`}
                      >
                        {getCategoryLabel(item.category)}
                      </span>
                      <p className="text-sm font-medium text-ink-secondary group-hover:text-brand-600 truncate flex-1 transition-colors">
                        {item.title}
                      </p>
                      <span className="text-xs text-ink-muted flex-shrink-0">
                        {getRelativeDate(item.date)}
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="mt-4">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    Acessar Base de Conhecimento
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
