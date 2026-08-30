import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Home, ChevronRight, Eye, FileText, Tag } from 'lucide-react';

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
    console.error('Error fetching term:', error);
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
    <div className="min-h-screen bg-surface-raised">
      {/* Breadcrumb */}
      <div className="bg-surface-page border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center space-x-2 text-sm text-ink-secondary">
            <Link href="/" className="hover:text-brand-600 flex items-center">
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/glossario" className="hover:text-brand-600">
              Glossário
            </Link>
            {term.category && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="text-ink-primary font-medium">{term.category}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="bg-surface-page rounded-[3px] border p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-ink-primary mb-3">
                {term.term}
              </h1>
              {term.category && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-brand-600" />
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-surface-deep text-ink-primary">
                    {term.category}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Eye className="h-4 w-4" />
              <span>{term.viewCount} visualizações</span>
            </div>
          </div>

          {/* Definition */}
          <div className="mt-6">
            <div className="prose prose-lg max-w-none prose-headings:text-ink-primary prose-p:text-ink-secondary prose-p:text-justify prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-ink-primary prose-strong:font-semibold prose-ul:my-4 prose-li:text-ink-secondary prose-li:my-2">
              <ReactMarkdown>{term.definition}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Lei Articles */}
        {term.leiArticles && term.leiArticles.length > 0 && (
          <div className="bg-surface-page rounded-[3px] border p-8 mb-6">
            <h2 className="text-xl font-bold text-ink-primary mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-600" />
              Artigos Relacionados da Lei 14.133/2021
            </h2>
            <div className="flex flex-wrap gap-2">
              {term.leiArticles.map((article: string) => (
                <span
                  key={article}
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-surface-deep text-ink-primary"
                >
                  Art. {article}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related Documents */}
        {term.relatedDocuments && term.relatedDocuments.length > 0 && (
          <div className="bg-surface-page rounded-[3px] border p-6 mb-6">
            <h2 className="text-xl font-bold text-ink-primary mb-4">
              Documentos Relacionados
            </h2>
            <div className="space-y-3">
              {term.relatedDocuments.map((doc: RelatedDocument) => (
                <div
                  key={doc.id}
                  className="p-4 bg-surface-raised rounded-[3px] hover:bg-surface-deep transition-colors"
                >
                  <h3 className="font-semibold text-ink-primary mb-1">{doc.title}</h3>
                  {doc.description && (
                    <p className="text-sm text-ink-secondary mb-2">{doc.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <span className="px-2 py-0.5 bg-surface-page rounded">{doc.type}</span>
                    <span className="px-2 py-0.5 bg-surface-page rounded">{doc.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Terms */}
        {term.relatedTerms && term.relatedTerms.length > 0 && (
          <div className="bg-surface-page rounded-[3px] border p-6">
            <h2 className="text-xl font-bold text-ink-primary mb-4">
              Termos Relacionados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {term.relatedTerms.map((relatedTerm: RelatedTerm) => (
                <Link
                  key={relatedTerm.id}
                  href={`/glossario/${relatedTerm.slug}`}
                  className="p-4 bg-surface-raised rounded-[3px] hover:bg-surface-raised hover:border-border-strong border border-border-subtle transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-ink-primary">{relatedTerm.term}</h3>
                      {relatedTerm.shortDef && (
                        <p className="text-sm text-ink-secondary mt-1 line-clamp-2">
                          {relatedTerm.shortDef}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-ink-muted" />
                  </div>
                  {relatedTerm.category && (
                    <span className="inline-block mt-2 text-xs px-2 py-1 bg-surface-page rounded text-ink-secondary">
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
            className="inline-flex items-center gap-2 text-brand-600 hover:text-ink-primary font-medium"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Voltar ao Glossário
          </Link>
        </div>
      </div>
    </div>
  );
}
