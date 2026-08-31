import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';

interface SharedSearchPageProps {
  params: Promise<{ shareId: string }>;
}

async function getSharedSearch(shareId: string) {
  const entry = await prisma.searchHistory.findFirst({
    where: {
      shareId,
      isPublic: true,
    },
    select: {
      query: true,
      aiAnswer: true,
      sources: true,
      legalSources: true,
      createdAt: true,
    },
  });

  if (!entry) return null;

  return {
    query: entry.query,
    aiAnswer: entry.aiAnswer,
    sources: entry.sources ? JSON.parse(entry.sources) : [],
    legalSources: entry.legalSources ? JSON.parse(entry.legalSources) : [],
    createdAt: entry.createdAt,
  };
}

export async function generateMetadata({ params }: SharedSearchPageProps): Promise<Metadata> {
  const { shareId } = await params;
  const data = await getSharedSearch(shareId);

  if (!data) {
    return { title: 'Resposta nao encontrada' };
  }

  return {
    title: `${data.query} - Prof. Daniel Barral`,
    description: data.aiAnswer?.slice(0, 160) || 'Resposta do assistente de IA sobre licitacoes e contratos.',
    openGraph: {
      title: data.query,
      description: data.aiAnswer?.slice(0, 160) || 'Resposta do assistente de IA',
      type: 'article',
    },
  };
}

export default async function SharedSearchPage({ params }: SharedSearchPageProps) {
  const { shareId } = await params;
  const data = await getSharedSearch(shareId);

  if (!data) {
    notFound();
  }

  const sources = data.sources as Array<{ title: string; category: string; url?: string }>;
  const legalSources = data.legalSources as Array<{ type: string; title: string; url: string }>;

  return (
    <main className="min-h-screen bg-brand-50">
      {/* Header */}
      <header className="bg-brand-700 text-white py-6">
        <div className="max-w-3xl mx-auto px-4">
          <Link href="/" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
            Prof. Daniel Barral
          </Link>
          <p className="text-brand-100 text-sm mt-1">Resposta do Assistente de IA</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Pergunta */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-primary mb-2">{data.query}</h1>
          <p className="text-sm text-ink-muted">
            {new Date(data.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Resposta */}
        {data.aiAnswer && (
          <div className="bg-white rounded-[6px] border border-border-subtle p-6 mb-6">
            <div className="prose prose-sm max-w-none text-ink-secondary whitespace-pre-wrap">
              {data.aiAnswer}
            </div>
          </div>
        )}

        {/* Fundamentacao Legal */}
        {legalSources.length > 0 && (
          <div className="bg-white rounded-[6px] border border-border-subtle p-6 mb-6">
            <h2 className="text-sm font-bold text-ink-secondary mb-3">Fundamentacao Legal</h2>
            <div className="flex flex-wrap gap-2">
              {legalSources.map((ls, i) => (
                <a
                  key={i}
                  href={ls.url}
                  target={ls.url.startsWith('http') ? '_blank' : undefined}
                  rel={ls.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 border border-brand-200 rounded-[6px] text-xs text-brand-800 hover:bg-brand-100 transition-colors"
                >
                  {ls.title}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Fontes */}
        {sources.length > 0 && (
          <div className="bg-white rounded-[6px] border border-border-subtle p-6 mb-6">
            <h2 className="text-sm font-bold text-ink-secondary mb-3">Fontes Consultadas</h2>
            <div className="space-y-2">
              {sources.map((source, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-surface-raised rounded-[6px]">
                  <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-medium rounded">
                    {source.category}
                  </span>
                  <span className="text-sm text-ink-secondary">{source.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-brand-50 rounded-[6px] border border-brand-200 p-6 text-center">
          <p className="text-ink-secondary mb-4">
            Quer fazer suas proprias perguntas ao assistente de IA?
          </p>
          <Link
            href="/planos"
            className="inline-block px-6 py-3 bg-brand-600 text-white rounded-[6px] font-bold hover:from-brand-700 hover:to-brand-700 transition-all border border-border-subtle"
          >
            Conheca nossos planos
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-6 mt-8">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-ink-muted">
          &copy; {new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados
        </div>
      </footer>
    </main>
  );
}
