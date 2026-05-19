import { Suspense } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { listPublishedFAQs } from '@/lib/faq/queries';
import { FAQAccordionItem } from '@/components/faq/FAQAccordionItem';
import { FAQSearch } from '@/components/faq/FAQSearch';

export const metadata: Metadata = {
  title: 'Perguntas Frequentes — Prof. Daniel Barral',
  description:
    'Tire suas dúvidas sobre cursos, certificados, acesso ao site e Lei 14.133/2021.',
};

// Revalida a cada 5 minutos (admin edita conteúdo de tempos em tempos)
export const revalidate = 300;

export default async function FAQPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string }>;
}) {
  const { category, search } = await searchParams;
  const groups = await listPublishedFAQs({ category, search });

  // Categorias distintas pra dropdown (sempre carrega todas, não só as filtradas)
  const allGroups = !category && !search ? groups : await listPublishedFAQs();
  const allCategories = allGroups.map((g) => g.category);

  const totalFAQs = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <HelpCircle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Perguntas Frequentes</h1>
              <p className="text-xl text-blue-100">
                Tire suas dúvidas sobre cursos, acesso e a Lei 14.133/2021
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 max-w-4xl py-8">
        <Suspense fallback={<div className="h-12 bg-gray-100 rounded animate-pulse mb-8" />}>
          <FAQSearch
            initialSearch={search}
            initialCategory={category}
            categories={allCategories}
          />
        </Suspense>

        {totalFAQs === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-gray-200">
            <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma pergunta encontrada</h3>
            <p className="text-gray-600">
              {search || category
                ? 'Tente outra busca ou categoria.'
                : 'Em breve teremos perguntas e respostas aqui.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.category}>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-100">
                  {group.category}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({group.items.length} {group.items.length === 1 ? 'pergunta' : 'perguntas'})
                  </span>
                </h2>
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <FAQAccordionItem
                      key={item.id}
                      id={item.id}
                      question={item.question}
                      answer={item.answer}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 text-center bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <p className="text-gray-700 mb-2">
            Não encontrou a resposta que procurava?
          </p>
          <a
            href="/contato"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            Entre em contato
          </a>
        </div>
      </section>
    </main>
  );
}
