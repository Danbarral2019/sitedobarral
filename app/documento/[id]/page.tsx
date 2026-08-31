import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Calendar, Tag, Lock } from 'lucide-react';
import BackLink from './BackLink';
import { getLeiArticles } from '@/lib/lei-articles';
import { hasAccessToDocument } from '@/lib/auth';
import { trechoDeAmostra } from '@/lib/text-preview';

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

/** Quantos caracteres da ementa a amostra pública mostra antes do corte. */
const LIMITE_AMOSTRA = 520;

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
      isCommon: true,
      courseId: true,
      aiClassification: true,
    },
  });

  if (!doc) {
    notFound();
  }

  // Documento restrito continua tendo página: quem não tem acesso recebe a
  // amostra com fonte e data, não um 404 indistinguível de link quebrado.
  const temAcesso = await hasAccessToDocument(doc);

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

  // Parse tags and leiArticles safely
  let tags: string[] = [];
  try {
    if (doc.tags) tags = JSON.parse(doc.tags);
  } catch { /* ignore */ }
  // leiArticlesArr traz repetições em parte do acervo (ex.: ON 33/2011 lista o
  // art. 75 duas vezes). Sem o Set, o mesmo chip aparece duplicado na tela e o
  // React reclama de key repetida.
  const leiArticles: string[] = [...new Set(getLeiArticles(doc))];

  const textoIntegral = doc.content || doc.description || '';
  const amostra = trechoDeAmostra(textoIntegral, LIMITE_AMOSTRA);
  const displayContent = temAcesso ? textoIntegral : amostra.trecho;

  return (
    <main className="min-h-screen bg-surface-page">
      <div className="container mx-auto px-4 max-w-4xl py-8">
        {/* Navigation — preserva contexto de busca via router.back() */}
        <div className="mb-8">
          <BackLink />
        </div>

        {/* Header */}
        <div className="bg-surface-raised rounded-[6px] border border-border-subtle overflow-hidden">
          <div className="p-8">
            {/* Category + Vigência Badges */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="font-label px-2.5 py-1 rounded-[3px] bg-surface-deep text-ink-secondary">
                {categoryLabel}
              </span>
              {vigencia === 'revogado' && (
                <span className="font-label px-2.5 py-1 rounded-[3px] border border-border-subtle text-ink-secondary">
                  Revogado
                </span>
              )}
              {vigencia === 'modificado' && (
                <span className="font-label px-2.5 py-1 rounded-[3px] border border-border-subtle text-ink-secondary">
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
            <h1 className="font-heading text-2xl md:text-3xl text-ink-primary mb-6 leading-tight max-w-[65ch]">
              {doc.title}
            </h1>

            {/* Lei Articles */}
            {leiArticles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-sm text-ink-muted">Artigos da Lei 14.133:</span>
                {leiArticles.map(art => (
                  <Link
                    key={art}
                    // Endereço público e canônico. Antes apontava para
                    // /area-restrita/artigo/N, rota logada: o visitante batia no
                    // login a partir de uma página pública. /artigo/N também não
                    // serve — é 301 para cá, e custa um salto a mais.
                    href={`/lei-14133?artigo=${encodeURIComponent(art)}`}
                    className="font-mono-tech px-2 py-0.5 text-sm text-ink-secondary border border-border-subtle rounded-[3px] hover:border-brand-600 hover:text-brand-600 transition-colors"
                  >
                    art. {art}
                  </Link>
                ))}
              </div>
            )}

            {/* Resumo IA contextualizado — curadoria, só para quem tem acesso */}
            {temAcesso && summary && (
              <div className="mb-6 bg-surface-deep border-l-2 border-amber-accent-deep rounded-r-[3px] p-5 max-w-[65ch]">
                <p className="font-label text-amber-accent-deep mb-2">Resumo</p>
                <p className="text-ink-secondary leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Content (texto cru — assunto, ementa, aprovação, natureza) */}
            {displayContent && (
              <div className="font-reading text-ink-secondary max-w-[65ch]">
                {displayContent.split('\n').map((paragraph, i) => (
                  <p key={i} className="mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {/* Tags — metadado de curadoria */}
            {temAcesso && tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-border-subtle">
                <Tag className="w-4 h-4 text-ink-muted" />
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-surface-deep text-ink-muted text-xs rounded-[3px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Oferta — só para quem não tem acesso ao conteúdo restrito */}
          {!temAcesso && (
            <div className="px-8 py-6 border-t border-border-subtle">
              <p className="font-label text-ink-muted mb-3 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Acervo restrito
              </p>
              <p className="font-reading text-ink-secondary max-w-[65ch] mb-5">
                {amostra.cortado
                  ? 'O texto acima está cortado. '
                  : ''}
                A assinatura abre o texto completo desta peça, o resumo com o
                contexto da decisão e a análise por IA com as fontes citadas
                sobre todo o acervo.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/planos"
                  className="inline-flex items-center px-5 py-2.5 bg-brand-600 text-white rounded-[3px] hover:bg-brand-800 transition-colors font-semibold text-sm"
                >
                  Ver os planos
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center px-5 py-2.5 text-ink-secondary border border-border-subtle rounded-[3px] hover:border-ink-muted transition-colors font-semibold text-sm"
                >
                  Já sou assinante
                </Link>
              </div>
            </div>
          )}

          {/* Fonte oficial — visível para todos, princípio 1 do PRODUCT.md */}
          {doc.url && (
            <div className="px-8 py-4 bg-surface-deep border-t border-border-subtle">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-800 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Ver a fonte oficial
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
