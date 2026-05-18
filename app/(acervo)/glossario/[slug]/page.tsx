import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Home, ChevronRight, Eye, FileText, Tag } from 'lucide-react';
import { apiLogger } from "@/lib/logger";

interface RelatedDocument {
  id: string;
  title: string;
  description?: string;
  type: string;
  category: string;
}

interface RelatedTerm {
  id: string;
  term: string;
  slug: string;
  shortDef?: string;
  category?: string;
}

async function getTermBySlug(slug: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/glossary/${slug}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.term;
  } catch (error) {
    apiLogger.error({ err: error }, 'Error fetching term:');
    return null;
  }
}

export default async function TermPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const term = await getTermBySlug(slug);

  if (!term) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <Link href="/" className="hover:text-blue-600 flex items-center">
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/glossario" className="hover:text-blue-600">
              Glossário
            </Link>
            {term.category && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="text-gray-900 font-medium">{term.category}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-3">
                {term.term}
              </h1>
              {term.category && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-blue-600" />
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {term.category}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Eye className="h-4 w-4" />
              <span>{term.viewCount} visualizações</span>
            </div>
          </div>

          {/* Definition */}
          <div className="mt-6">
            <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:text-justify prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:my-4 prose-li:text-gray-700 prose-li:my-2">
              <ReactMarkdown>{term.definition}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Lei Articles */}
        {term.leiArticles && term.leiArticles.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Artigos Relacionados da Lei 14.133/2021
            </h2>
            <div className="flex flex-wrap gap-2">
              {term.leiArticles.map((article: string) => (
                <span
                  key={article}
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800"
                >
                  Art. {article}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related Documents */}
        {term.relatedDocuments && term.relatedDocuments.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Documentos Relacionados
            </h2>
            <div className="space-y-3">
              {term.relatedDocuments.map((doc: RelatedDocument) => (
                <div
                  key={doc.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">{doc.title}</h3>
                  {doc.description && (
                    <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="px-2 py-0.5 bg-white rounded">{doc.type}</span>
                    <span className="px-2 py-0.5 bg-white rounded">{doc.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Terms */}
        {term.relatedTerms && term.relatedTerms.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Termos Relacionados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {term.relatedTerms.map((relatedTerm: RelatedTerm) => (
                <Link
                  key={relatedTerm.id}
                  href={`/glossario/${relatedTerm.slug}`}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-blue-50 hover:border-blue-300 border border-gray-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{relatedTerm.term}</h3>
                      {relatedTerm.shortDef && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {relatedTerm.shortDef}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                  {relatedTerm.category && (
                    <span className="inline-block mt-2 text-xs px-2 py-1 bg-white rounded text-gray-600">
                      {relatedTerm.category}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <Link
            href="/glossario"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Voltar ao Glossário
          </Link>
        </div>
      </div>
    </div>
  );
}
