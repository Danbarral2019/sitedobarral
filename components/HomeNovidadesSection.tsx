import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

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
    acordao: 'bg-blue-100 text-blue-700',
    'manual-tcu': 'bg-emerald-100 text-emerald-700',
    'orientacao-normativa': 'bg-purple-100 text-purple-700',
    enunciados: 'bg-amber-100 text-amber-700',
    decor: 'bg-indigo-100 text-indigo-700',
  };
  return colors[category] || 'bg-gray-100 text-gray-700';
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    acordao: 'Acordao TCU',
    'manual-tcu': 'Manual TCU',
    'orientacao-normativa': 'ON AGU',
    enunciados: 'Enunciado',
    decor: 'DECOR',
    'parecer-vinculante': 'Parecer',
  };
  return labels[category] || 'Documento';
}

export default async function HomeNovidadesSection() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let recentDocs: { id: string; title: string; category: string; uploadedAt: Date | null }[] = [];
  let blogPosts: { id: string; title: string; slug: string; excerpt: string | null; publishedAt: Date | null }[] = [];

  try {
    [recentDocs, blogPosts] = await Promise.all([
      prisma.document.findMany({
        where: {
          uploadedAt: { gte: thirtyDaysAgo },
          isPublic: true,
        },
        select: {
          id: true,
          title: true,
          category: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: 'desc' },
        take: 4,
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
        take: 3,
      }),
    ]);
  } catch {
    // DB unavailable (e.g. CI build) — render nothing
  }

  const hasContent = recentDocs.length > 0 || blogPosts.length > 0;
  if (!hasContent) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">Novidades</h2>
            <div className="h-1 w-24 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-3">Ultimas atualizacoes de conteudo e materiais</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Blog posts */}
            {blogPosts.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                  Blog
                </h3>
                <div className="space-y-3">
                  {blogPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                      <p className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {post.title}
                      </p>
                      {post.excerpt && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {post.publishedAt
                            ? getRelativeDate(new Date(post.publishedAt))
                            : ''}
                        </span>
                        <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Ler <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recent documents */}
            {recentDocs.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                  Conteudo Recente
                </h3>
                <div className="space-y-3">
                  {recentDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3"
                    >
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getCategoryColor(doc.category)}`}
                      >
                        {getCategoryLabel(doc.category)}
                      </span>
                      <p className="text-sm font-medium text-gray-800 truncate flex-1">
                        {doc.title}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {doc.uploadedAt
                          ? getRelativeDate(new Date(doc.uploadedAt))
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="text-center mt-8">
            <Link
              href="/validar-acesso"
              className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-700 transition-colors text-sm"
            >
              Acesse a area restrita para ver todo o conteudo
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
