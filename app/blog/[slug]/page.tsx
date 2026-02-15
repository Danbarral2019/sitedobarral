import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, User, Tag } from 'lucide-react';
import { BlogPost } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import MarkdownContent from '@/components/MarkdownContent';
import ShareButtons from '@/components/ShareButtons';
import { safeParseArray } from '@/lib/utils';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug }
  });

  if (!post || !post.isPublished) {
    return {
      title: 'Post não encontrado',
    };
  }

  const tags = safeParseArray(post.tags);

  return {
    title: post.title,
    description: post.excerpt,
    keywords: tags,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt.toISOString(),
      authors: [post.author],
      tags: tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  };
}

export async function generateStaticParams() {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      select: { slug: true }
    });

    return posts.map((post: { slug: string }) => ({
      slug: post.slug,
    }));
  } catch {
    // Database unavailable (e.g. CI build) — pages will be generated on demand via ISR
    return [];
  }
}

// Revalidar a cada 1 hora
export const revalidate = 3600;

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dbPost = await prisma.blogPost.findUnique({
    where: { slug }
  });

  if (!dbPost || !dbPost.isPublished) {
    notFound();
  }

  const post = {
    ...dbPost,
    publishedAt: new Date(dbPost.publishedAt),
    tags: safeParseArray(dbPost.tags)
  };

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

  const relatedPostsData = await prisma.blogPost.findMany({
    where: {
      AND: [
        { id: { not: post.id } },
        { isPublished: true }
      ]
    },
    orderBy: { publishedAt: 'desc' },
    take: 10
  });

  const relatedPosts = relatedPostsData
    .map((p: BlogPost) => ({
      ...p,
      tags: safeParseArray(p.tags)
    }))
    .filter((p: BlogPost & { tags: string[] }) => p.tags.some((tag: string) => post.tags.includes(tag)))
    .slice(0, 3);

  return (
    <main className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para o Blog
          </Link>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                headline: post.title,
                description: post.excerpt,
                author: {
                  '@type': 'Person',
                  name: post.author,
                  url: 'https://profbarral.com.br/sobre',
                },
                datePublished: post.publishedAt.toISOString(),
                dateModified: post.updatedAt?.toISOString() || post.publishedAt.toISOString(),
                publisher: {
                  '@type': 'Person',
                  name: 'Prof. Daniel Barral',
                  url: 'https://profbarral.com.br',
                },
                mainEntityOfPage: {
                  '@type': 'WebPage',
                  '@id': `https://profbarral.com.br/blog/${post.slug}`,
                },
                keywords: post.tags.join(', '),
                inLanguage: 'pt-BR',
              }),
            }}
          />

          <article className="bg-white rounded-lg shadow-lg p-8">
            <header className="mb-8">
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm"
                  >
                    <Tag className="w-3 h-3 inline mr-1" />
                    {tag}
                  </span>
                ))}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 pb-6 border-b">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{post.author}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(post.publishedAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{calculateReadTime(post.content)}</span>
                </div>
              </div>
            </header>

            <div className="mb-8">
              <div className="text-xl text-gray-700 font-medium mb-6 text-justify leading-relaxed">
                {post.excerpt}
              </div>
              <MarkdownContent content={post.content} />
            </div>

            <footer className="border-t pt-6">
              <ShareButtons
                url={`/blog/${post.slug}`}
                title={post.title}
                description={post.excerpt}
              />
            </footer>
          </article>

          {relatedPosts.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Artigos Relacionados</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost: BlogPost & { tags: string[] }) => (
                  <Link
                    key={relatedPost.id}
                    href={`/blog/${relatedPost.slug}`}
                    className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
                  >
                    <h3 className="font-semibold mb-2 line-clamp-2">{relatedPost.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-3">{relatedPost.excerpt}</p>
                    <p className="text-primary-600 text-sm font-semibold mt-3">
                      Ler mais →
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 bg-primary-50 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Gostou deste conteúdo?</h2>
            <p className="text-gray-700 mb-6">
              Cadastre-se para receber novos artigos e materiais exclusivos sobre 
              Direito Administrativo diretamente em seu e-mail.
            </p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Seu e-mail"
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-primary-500"
              />
              <button
                type="submit"
                className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Cadastrar
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}