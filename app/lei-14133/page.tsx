import { Metadata } from 'next';
import { LegalSidebar } from '@/components/lei-14133/LegalSidebar';
import { LegalSearchBar } from '@/components/lei-14133/LegalSearchBar';
import { LegalCover } from '@/components/lei-14133/LegalCover';
import { LegalReadingView } from '@/components/lei-14133/LegalReadingView';
import { LEI_14133_TITULOS } from '@/data/lei-14133-capitulos';
import { getArticleCounts, getChapterCounts, getLeiStats } from '@/lib/lei-14133/queries';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Lei 14.133/2021',
  description:
    'Lei nº 14.133, de 1º de abril de 2021. Nova Lei de Licitações e Contratos Administrativos — texto integral dos 193 artigos com jurisprudência e orientações relacionadas.',
  alternates: { canonical: '/lei-14133' },
};

export default async function LeiPage() {
  const [stats, articleCounts, chapterCounts] = await Promise.all([
    getLeiStats(),
    getArticleCounts(),
    getChapterCounts(),
  ]);

  return (
    <main className="min-h-screen bg-surface-page">
      <div className="flex">
        <LegalSidebar titulos={LEI_14133_TITULOS} chapterCounts={chapterCounts} />
        <div className="flex-1 min-w-0">
          <LegalSearchBar />
          <LegalCover stats={stats} />
          <LegalReadingView titulos={LEI_14133_TITULOS} articleCounts={articleCounts} />

          {/* Rodapé */}
          <footer className="border-t-4 border-ink-primary px-6 lg:px-10 py-10 mt-12 bg-surface-raised">
            <div className="max-w-[80ch]">
              <p className="font-label text-amber-accent-deep mb-3">Texto Oficial</p>
              <p className="font-serif text-base text-ink-secondary leading-relaxed mb-5">
                Esta edição reproduz o texto da Lei nº 14.133, publicado no Diário Oficial da
                União em 1º de abril de 2021, com as alterações posteriores. A organização por
                títulos e capítulos segue a hierarquia oficial da lei.
              </p>
              <a
                href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-sans text-sm font-medium text-amber-accent-deep hover:text-amber-accent border-b border-amber-accent pb-0.5"
              >
                Conferir no Planalto →
              </a>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
