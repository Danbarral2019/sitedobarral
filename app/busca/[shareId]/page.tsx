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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-6">
        <div className="max-w-3xl mx-auto px-4">
          <Link href="/" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
            Prof. Daniel Barral
          </Link>
          <p className="text-blue-100 text-sm mt-1">Resposta do Assistente de IA</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Pergunta */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{data.query}</h1>
          <p className="text-sm text-gray-500">
            {new Date(data.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Resposta */}
        {data.aiAnswer && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
            <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
              {data.aiAnswer}
            </div>
          </div>
        )}

        {/* Fundamentacao Legal */}
        {legalSources.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Fundamentacao Legal</h2>
            <div className="flex flex-wrap gap-2">
              {legalSources.map((ls, i) => (
                <a
                  key={i}
                  href={ls.url}
                  target={ls.url.startsWith('http') ? '_blank' : undefined}
                  rel={ls.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800 hover:bg-indigo-100 transition-colors"
                >
                  {ls.title}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Fontes */}
        {sources.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Fontes Consultadas</h2>
            <div className="space-y-2">
              {sources.map((source, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                    {source.category}
                  </span>
                  <span className="text-sm text-gray-800">{source.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200 p-6 text-center">
          <p className="text-gray-700 mb-4">
            Quer fazer suas proprias perguntas ao assistente de IA?
          </p>
          <Link
            href="/planos"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
          >
            Conheca nossos planos
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 mt-8">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados
        </div>
      </footer>
    </main>
  );
}
