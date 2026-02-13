import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, Tag } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  acordao: 'Acórdão TCU',
  'manual-tcu': 'Manual TCU',
  'orientacao-normativa': 'Orientação Normativa AGU',
  enunciados: 'Enunciado',
  decor: 'DECOR',
  'parecer-vinculante': 'Parecer Vinculante',
  'ato-normativo': 'Ato Normativo',
  apostila: 'Apostila',
  'boa_pratica': 'Outro Ato Normativo',
};

const CATEGORY_COLORS: Record<string, string> = {
  acordao: 'bg-blue-100 text-blue-800',
  'manual-tcu': 'bg-emerald-100 text-emerald-800',
  'orientacao-normativa': 'bg-purple-100 text-purple-800',
  enunciados: 'bg-amber-100 text-amber-800',
  decor: 'bg-indigo-100 text-indigo-800',
  'parecer-vinculante': 'bg-rose-100 text-rose-800',
  'ato-normativo': 'bg-teal-100 text-teal-800',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { title: true, category: true },
  });

  if (!doc) return { title: 'Documento não encontrado' };

  const categoryLabel = CATEGORY_LABELS[doc.category] || 'Documento';
  return {
    title: `${doc.title} | ${categoryLabel} | Prof. Daniel Barral`,
    description: `${categoryLabel}: ${doc.title}`,
  };
}

export default async function DocumentoPage({ params }: PageProps) {
  const { id } = await params;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      content: true,
      url: true,
      uploadedAt: true,
      tags: true,
      leiArticles: true,
      isPublic: true,
    },
  });

  if (!doc || !doc.isPublic) {
    notFound();
  }

  const categoryLabel = CATEGORY_LABELS[doc.category] || 'Documento';
  const categoryColor = CATEGORY_COLORS[doc.category] || 'bg-gray-100 text-gray-800';

  // Parse tags and leiArticles safely
  let tags: string[] = [];
  let leiArticles: string[] = [];
  try {
    if (doc.tags) tags = JSON.parse(doc.tags);
  } catch { /* ignore */ }
  try {
    if (doc.leiArticles) leiArticles = JSON.parse(doc.leiArticles);
  } catch { /* ignore */ }

  const displayContent = doc.content || doc.description || '';

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 max-w-4xl py-8">
        {/* Navigation */}
        <div className="mb-8">
          <Link
            href="/busca"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para pesquisa
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8">
            {/* Category Badge */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1 text-sm font-bold rounded-lg ${categoryColor}`}>
                {categoryLabel}
              </span>
              {doc.uploadedAt && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  {new Date(doc.uploadedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 leading-tight">
              {doc.title}
            </h1>

            {/* Lei Articles */}
            {leiArticles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-sm font-semibold text-gray-600">Artigos da Lei 14.133:</span>
                {leiArticles.map(art => (
                  <Link
                    key={art}
                    href={`/area-restrita/artigo/${art}`}
                    className="px-2.5 py-1 bg-indigo-50 text-indigo-800 text-xs font-semibold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"
                  >
                    Art. {art}
                  </Link>
                ))}
              </div>
            )}

            {/* Content */}
            {displayContent && (
              <div className="prose prose-gray max-w-none">
                {displayContent.split('\n').map((paragraph, i) => (
                  <p key={i} className="text-gray-700 leading-relaxed mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-gray-100">
                <Tag className="w-4 h-4 text-gray-400" />
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer with source link */}
          {doc.url && (
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Ver fonte original
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
