import Link from 'next/link';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { getCachedPublishedBlogPosts } from '@/lib/cached-queries';
import { getBlogPostBorderColor, getBlogPostTagColor } from '@/lib/course-colors';
import { safeParseArray } from '@/lib/utils';
import NewsletterForm from '@/components/NewsletterForm';

export const metadata: Metadata = {
  title: 'Blog Jurídico',
  description: 'Artigos e análises sobre Direito Administrativo, Licitações, Contratos Públicos, jurisprudência e legislação atualizada pelo Prof. Daniel Barral.',
  keywords: [
    'blog direito administrativo',
    'artigos licitações',
    'análise jurisprudência',
    'nova lei licitações',
    'contratos administrativos',
    'TCU',
    'AGU',
    'direito público',
  ],
  openGraph: {
    title: 'Blog Jurídico | Prof. Daniel Barral',
    description: 'Artigos e análises sobre Direito Administrativo, Licitações e Contratos Públicos',
    url: 'https://profdanielbarral.com/blog',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog Jurídico | Prof. Daniel Barral',
    description: 'Artigos sobre Direito Administrativo e Licitações',
  },
  alternates: {
    canonical: '/blog',
  },
};

// Revalidar a cada 1 hora
export const revalidate = 3600;

export default async function BlogPage() {
  // Usa query cacheada para melhor performance
  let posts: Awaited<ReturnType<typeof getCachedPublishedBlogPosts>> = [];
  try {
    posts = await getCachedPublishedBlogPosts();
  } catch {
    // Database unavailable (e.g. CI build)
  }

  const publishedPosts = posts.map((post) => ({
    ...post,
    publishedAt: new Date(post.publishedAt),
    tags: safeParseArray(post.tags)
  }));

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  const calculateReadTime = (content: string) => {
    if (!content || content.trim() === '') {
      return '1 min de leitura';
    }
    const wordsPerMinute = 200;
    const words = content.split(' ').length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min de leitura`;
  };

  return (
    <main className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block">
              <h1 className="text-5xl font-bold mb-3 text-ink-primary font-cinzel">Blog Jurídico</h1>
              <div className="h-1.5 w-32 bg-surface-raised rounded-full mx-auto mb-6"></div>
            </div>
            <p className="text-xl text-ink-primary leading-relaxed">
              Artigos, análises e comentários sobre Direito Administrativo,
              Licitações e Contratos Públicos
            </p>
          </div>

          <div className="space-y-8">
            {publishedPosts.map((post, index: number) => {
              const borderColor = getBlogPostBorderColor(index);

              return (
                <article key={post.id} className={`bg-surface-page rounded-md overflow-hidden hover:shadow-2xl transition-all border-l-4 ${borderColor} hover:scale-[1.01]`}>
                  <div className="p-8">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.map((tag: string, idx: number) => {
                        const tagColor = getBlogPostTagColor(idx);
                        return (
                          <span
                            key={tag}
                            className={`${tagColor.bg} ${tagColor.text} px-4 py-1.5 rounded-full text-sm font-semibold`}
                          >
                            {tag}
                          </span>
                        );
                      })}
                    </div>

                    <h2 className="text-3xl font-bold mb-3">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="text-ink-primary hover:text-brand-700 transition-colors"
                      >
                        {post.title}
                      </Link>
                    </h2>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-ink-primary font-medium mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(post.publishedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{calculateReadTime(post.excerpt)}</span>
                    </div>
                  </div>

                  <p className="text-ink-primary mb-4 line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>

                  <Link
                    href={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 text-white bg-surface-raised px-6 py-3 rounded-md font-bold hover: hover: transition-all hover:shadow-lg"
                  >
                    Ler artigo completo
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </article>
              );
            })}
          </div>

          {publishedPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-ink-secondary">Nenhum artigo publicado ainda.</p>
            </div>
          )}

          <div className="mt-12 relative overflow-hidden bg-surface-raised rounded-md p-10 md:p-12 text-center border-4 border-border-strong">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE0YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0yNCAzOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"></div>

            <div className="relative z-10">
              <div className="inline-block mb-4">
                <div className="bg-surface-page/20 px-4 py-2 rounded-full">
                  <span className="text-white font-semibold text-sm">📰 Blog Jurídico</span>
                </div>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                Receba Novos Artigos
              </h2>
              <p className="text-xl text-white mb-10 max-w-2xl mx-auto leading-relaxed">
                Cadastre-se para receber notificações sobre novos artigos e materiais exclusivos
                diretamente no seu e-mail
              </p>

              <div className="max-w-xl mx-auto bg-surface-page/10 p-2 rounded-md border-2 border-white/30">
                <NewsletterForm variant="inline" className="[&_input]:bg-surface-page [&_input]:text-ink-primary [&_input]:placeholder:text-ink-muted [&_input]:font-medium [&_input]:text-lg [&_input]:focus:ring-amber-accent/25 [&_input]:border-0 [&_button]:bg-brand-600 [&_button]: [&_button]: [&_button]:text-ink-primary [&_button]:font-bold [&_button]:hover: [&_button]:hover: [&_button]:" />
              </div>

              <p className="text-white/80 text-sm mt-4">
                ✓ Conteúdo semanal · ✓ Sem spam · ✓ Cancele quando quiser
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}