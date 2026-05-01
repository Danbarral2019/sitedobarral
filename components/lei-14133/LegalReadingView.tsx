/**
 * LegalReadingView — main column da Direção α v2 ("menos apagada").
 *
 * Headers de capítulo agora têm numeral ROMANO grande decorativo à esquerda,
 * estilo abertura de capítulo de livro impresso. Drop cap no primeiro
 * artigo de cada capítulo. Tipografia ampliada.
 */

import { ArticleFull } from './ArticleFull';
import type { LeiTitle } from '@/data/lei-14133-capitulos';
import type { ArticleCounts } from '@/lib/lei-14133/queries';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

interface LegalReadingViewProps {
  titulos: readonly LeiTitle[];
  articleCounts: Record<string, ArticleCounts>;
}

export function LegalReadingView({ titulos, articleCounts }: LegalReadingViewProps) {
  return (
    <div className="px-6 lg:px-10 py-8">
      {titulos.map((titulo) => (
        <section
          key={titulo.id}
          id={titulo.id}
          aria-labelledby={`titulo-${titulo.id}-heading`}
          className="mb-20 first:mt-2"
        >
          {/* Título — header tipográfico grande */}
          <header className="mb-10 pb-4 border-b-2 border-ink-primary">
            <p className="font-label text-amber-accent-deep mb-2">Título {titulo.number}</p>
            <h2
              id={`titulo-${titulo.id}-heading`}
              className="font-display text-3xl md:text-4xl text-ink-primary tracking-tight font-semibold"
            >
              {titulo.name}
            </h2>
          </header>

          {titulo.chapters.map((chapter) => {
            // Títulos V/VI/VII oficialmente não têm capítulos — o data
            // gera um pseudo-capítulo com `number === '—'`. Pra esses,
            // os artigos vêm direto sob o título sem header de capítulo.
            const hasRealChapter = chapter.number !== '—';
            return (
              <section
                key={chapter.id}
                id={chapter.id}
                data-chapter-section="true"
                aria-labelledby={hasRealChapter ? `cap-${chapter.id}-heading` : undefined}
                className="mb-16 scroll-mt-24"
              >
                {hasRealChapter && (
                  <header className="mb-8 flex items-baseline gap-6">
                    <div className="flex-shrink-0 pt-2" aria-hidden="true">
                      <span className="font-display text-6xl md:text-7xl font-light text-amber-accent leading-none tracking-tighter">
                        {chapter.number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-3">
                      <p className="font-label text-ink-muted mb-1">
                        Capítulo {chapter.number}
                        {chapter.section && <span> · {chapter.section}</span>}
                      </p>
                      <h3
                        id={`cap-${chapter.id}-heading`}
                        className="font-display text-2xl md:text-3xl text-ink-primary font-semibold tracking-tight leading-tight"
                      >
                        {chapter.title}
                      </h3>
                    </div>
                  </header>
                )}

                {/* Artigos do capítulo */}
                <div className="max-w-[80ch]">
                  {chapter.articles.map((numero, idx) => {
                    const article = LEI_14133_ARTIGOS[numero];
                    if (!article) return null;
                    return (
                      <ArticleFull
                        key={numero}
                        numero={numero}
                        ementa={article.ementa}
                        counts={articleCounts[numero]}
                        withDropCap={idx === 0}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>
      ))}
    </div>
  );
}
