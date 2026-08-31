import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Calendar, Tag } from 'lucide-react';
import BackLink from './BackLink';
import { parseLeiArticles, getLeiArticles } from '@/lib/lei-articles';

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
  sumula: 'Súmulas TCU',
  consulta_tcu: 'Respostas a Consultas TCU',
  informativo: 'Informativos de Licitação TCU',
};

const CATEGORY_COLORS: Record<string, string> = {
  acordao: 'bg-surface-deep text-ink-primary',
  'manual-tcu': 'bg-surface-deep text-ink-primary',
  'orientacao-normativa': 'bg-surface-deep text-ink-primary',
  enunciados: 'bg-amber-accent-soft text-amber-accent-deep',
  decor: 'bg-surface-deep text-ink-primary',
  'parecer-vinculante': 'bg-surface-deep text-ink-primary',
  'ato-normativo': 'bg-surface-deep text-ink-primary',
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
      leiArticlesArr: true,
      isPublic: true,
      aiClassification: true,
    },
  });

  if (!doc || !doc.isPublic) {
    notFound();
  }

  // Extrai resumo IA + vigência do aiClassification (preenchido pelo
  // pipeline CONUNI: sync + classify + summarize)
  let summary: string | null = null;
  let vigencia: 'revogado' | 'modificado' | null = null;
  if (doc.aiClassification) {
    try {
      const ai = JSON.parse(doc.aiClassification) as { summary?: string; vigencia?: string };
      if (ai.summary && ai.summary.trim().length > 5) summary = ai.summary.trim();
      if (ai.vigencia === 'revogado' || ai.vigencia === 'modificado') vigencia = ai.vigencia;
    } catch { /* ignora */ }
  }

  const categoryLabel = CATEGORY_LABELS[doc.category] || 'Documento';
  const categoryColor = CATEGORY_COLORS[doc.category] || 'bg-surface-deep text-ink-primary';

  // Parse tags and leiArticles safely
  let tags: string[] = [];
  try {
    if (doc.tags) tags = JSON.parse(doc.tags);
  } catch { /* ignore */ }
  const leiArticles: string[] = getLeiArticles(doc);

  const displayContent = doc.content || doc.description || '';

  return (
    <main className="min-h-screen bg-surface-raised">
      <div className="container mx-auto px-4 max-w-4xl py-8">
        {/* Navigation — preserva contexto de busca via router.back() */}
        <div className="mb-8">
          <BackLink />
        </div>

        {/* Header */}
        <div className="bg-surface-page rounded-md border border-border-subtle overflow-hidden">
          <div className="p-8">
            {/* Category + Vigência Badges */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className={`px-3 py-1 text-sm font-bold rounded-[3px] ${categoryColor}`}>
                {categoryLabel}
              </span>
              {vigencia === 'revogado' && (
                <span className="px-3 py-1 text-xs font-bold uppercase tracking-wide bg-surface-deep text-semantic-error rounded-[3px]">
                  Revogado
                </span>
              )}
              {vigencia === 'modificado' && (
                <span className="px-3 py-1 text-xs font-bold uppercase tracking-wide bg-amber-accent-soft text-amber-accent-deep rounded-[3px]">
                  Modificado
                </span>
              )}
              {doc.uploadedAt && (
                <span className="flex items-center gap-1.5 text-sm text-ink-muted">
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
            <h1 className="text-2xl md:text-3xl font-bold text-ink-primary mb-6 leading-tight">
              {doc.title}
            </h1>

            {/* Lei Articles */}
            {leiArticles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-sm font-semibold text-ink-secondary">Artigos da Lei 14.133:</span>
                {leiArticles.map(art => (
                  <Link
                    key={art}
                    href={`/area-restrita/artigo/${art}`}
                    className="px-2.5 py-1 bg-surface-raised text-ink-primary text-xs font-semibold rounded-[3px] border border-border-subtle hover:bg-surface-deep transition-colors"
                  >
                    Art. {art}
                  </Link>
                ))}
              </div>
            )}

            {/* Resumo IA contextualizado (gerado pelo pipeline CONUNI) */}
            {summary && (
              <div className="mb-6 bg-surface-raised border-l-4 border-brand-600 rounded-r-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="text-brand-600 font-bold text-xs uppercase tracking-wider whitespace-nowrap pt-0.5">
                    Resumo
                  </div>
                  <p className="text-ink-primary leading-relaxed">{summary}</p>
                </div>
              </div>
            )}

            {/* Content (texto cru — assunto, ementa, aprovação, natureza) */}
            {displayContent && (
              <div className="prose prose-gray max-w-none">
                {displayContent.split('\n').map((paragraph, i) => (
                  <p key={i} className="text-ink-secondary leading-relaxed mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-border-subtle">
                <Tag className="w-4 h-4 text-ink-muted" />
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-surface-deep text-ink-secondary text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer with source link */}
          {doc.url && (
            <div className="px-8 py-4 bg-surface-raised border-t border-border-subtle">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-surface-page rounded-[3px] hover:bg-brand-800 transition-colors font-semibold text-sm"
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
