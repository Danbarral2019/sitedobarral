/**
 * Componente que adiciona schema.org FAQPage para artigos da Lei 14.133/2021
 * Melhora SEO com rich snippets de FAQ no Google
 */

interface FAQItem {
  question: string;
  answer: string;
}

interface LeiArticleFAQSchemaProps {
  articleNumber: string;
  faqs?: FAQItem[];
}

export default function LeiArticleFAQSchema({ articleNumber, faqs }: LeiArticleFAQSchemaProps) {
  // FAQs padrão se não fornecidas
  const defaultFAQs: FAQItem[] = [
    {
      question: `O que diz o artigo ${articleNumber} da Lei 14.133/2021?`,
      answer: `O artigo ${articleNumber} da Nova Lei de Licitações (Lei 14.133/2021) trata de disposições importantes sobre licitações e contratos administrativos no Brasil. Consulte o texto completo no site oficial do Planalto.`,
    },
    {
      question: 'A Lei 14.133/2021 já está em vigor?',
      answer: 'Sim, a Lei 14.133/2021 (Nova Lei de Licitações e Contratos) entrou em vigor em 1º de abril de 2021, com período de transição de dois anos para implementação completa.',
    },
    {
      question: 'Onde posso estudar mais sobre a Lei 14.133/2021?',
      answer: 'O Prof. Daniel Barral oferece cursos especializados sobre a Nova Lei de Licitações, com análise detalhada de todos os artigos, jurisprudência atualizada e casos práticos.',
    },
  ];

  const faqList = faqs && faqs.length > 0 ? faqs : defaultFAQs;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqList.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
    />
  );
}
