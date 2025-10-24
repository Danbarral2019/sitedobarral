'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content">
      <style jsx>{`
        .markdown-content {
          font-size: 1.125rem;
          line-height: 1.75;
          color: #374151;
          max-width: 100%;
        }

        /* TÍTULOS - Hierarquia clara e espaçamento generoso */
        /* H1 dentro do conteúdo é tratado como H2 (título principal já está fora) */
        .markdown-content :global(h1) {
          font-size: 2rem;
          font-weight: 700;
          color: #1E40AF;
          margin-top: 3.5rem;
          margin-bottom: 1.5rem;
          padding-bottom: 0;
          border-bottom: none;
          line-height: 1.4;
        }

        .markdown-content :global(h2) {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1E40AF;
          margin-top: 3rem;
          margin-bottom: 1.25rem;
          line-height: 1.4;
        }

        .markdown-content :global(h3) {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1E3A8A;
          margin-top: 2.25rem;
          margin-bottom: 1rem;
          line-height: 1.4;
        }

        .markdown-content :global(h4) {
          font-size: 1.25rem;
          font-weight: 600;
          color: #374151;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
          line-height: 1.5;
        }

        /* PARÁGRAFOS - Espaçamento balanceado e texto justificado */
        .markdown-content :global(p) {
          text-align: justify;
          text-justify: inter-word;
          margin-bottom: 1.5rem;
          line-height: 1.75;
          color: #374151;
          hyphens: auto;
        }

        /* CITAÇÕES - Recuo visual CLARO e destaque */
        .markdown-content :global(blockquote) {
          margin: 2.5rem 0;
          margin-left: 2rem;
          margin-right: 1rem;
          padding: 1.5rem 2rem;
          border-left: 6px solid #3B82F6;
          background: linear-gradient(to right, #EFF6FF, #DBEAFE);
          border-radius: 0 0.75rem 0.75rem 0;
          font-style: italic;
          color: #1E3A8A;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
        }

        .markdown-content :global(blockquote p) {
          margin-bottom: 0.75rem;
        }

        .markdown-content :global(blockquote p:last-child) {
          margin-bottom: 0;
        }

        /* LISTAS - Espaçamento entre itens */
        .markdown-content :global(ul),
        .markdown-content :global(ol) {
          margin: 2rem 0;
          padding-left: 2rem;
        }

        .markdown-content :global(li) {
          margin-bottom: 1rem;
          line-height: 1.8;
          color: #374151;
        }

        .markdown-content :global(li p) {
          margin-bottom: 0.5rem;
        }

        /* NEGRITO e ITÁLICO */
        .markdown-content :global(strong) {
          font-weight: 700;
          color: #111827;
        }

        .markdown-content :global(em) {
          font-style: italic;
          color: #4B5563;
        }

        /* LINKS */
        .markdown-content :global(a) {
          color: #2563EB;
          text-decoration: none;
          font-weight: 500;
          border-bottom: 1px solid transparent;
          transition: all 0.2s;
        }

        .markdown-content :global(a:hover) {
          color: #1D4ED8;
          border-bottom-color: #1D4ED8;
        }

        /* CÓDIGO INLINE */
        .markdown-content :global(code) {
          background: #F3F4F6;
          color: #1F2937;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          font-size: 0.9em;
          font-family: 'Courier New', monospace;
          border: 1px solid #E5E7EB;
        }

        /* BLOCOS DE CÓDIGO */
        .markdown-content :global(pre) {
          background: #1F2937;
          color: #F9FAFB;
          padding: 1.5rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          margin: 2rem 0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .markdown-content :global(pre code) {
          background: transparent;
          color: inherit;
          padding: 0;
          border: none;
          font-size: 0.95rem;
        }

        /* TABELAS */
        .markdown-content :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 2rem 0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .markdown-content :global(thead) {
          background: #F3F4F6;
        }

        .markdown-content :global(th) {
          padding: 1rem;
          text-align: left;
          font-weight: 700;
          color: #111827;
          border-bottom: 2px solid #D1D5DB;
        }

        .markdown-content :global(td) {
          padding: 1rem;
          border-bottom: 1px solid #E5E7EB;
          color: #374151;
        }

        /* LINHAS HORIZONTAIS */
        .markdown-content :global(hr) {
          border: none;
          border-top: 2px solid #E5E7EB;
          margin: 3rem 0;
        }

        /* IMAGENS */
        .markdown-content :global(img) {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin: 2rem auto;
          display: block;
        }

        /* NOTAS DE RODAPÉ - Estilo acadêmico tradicional */
        .markdown-content :global(sup) {
          font-size: 0.75em;
          line-height: 0;
          position: relative;
          vertical-align: baseline;
          top: -0.5em;
        }

        .markdown-content :global(sup a) {
          color: #2563EB;
          font-weight: 600;
          text-decoration: none;
          padding: 0 0.15em;
          border-bottom: none;
        }

        .markdown-content :global(sup a:hover) {
          color: #1D4ED8;
          text-decoration: underline;
        }

        /* Seção de Notas de Rodapé */
        .markdown-content :global(h2:has(+ p [id^="fn"])),
        .markdown-content :global(h2):has-text("Notas de Rodapé") {
          margin-top: 4rem;
          padding-top: 2rem;
          border-top: 3px double #D1D5DB;
          font-size: 1.5rem;
          color: #1E3A8A;
        }

        /* Estilo das notas individuais */
        .markdown-content :global([id^="fn"]) {
          display: block;
          margin-bottom: 1rem;
          padding-left: 2rem;
          position: relative;
          font-size: 0.95rem;
          line-height: 1.6;
          color: #4B5563;
          text-align: justify;
        }

        .markdown-content :global([id^="fn"]::before) {
          content: attr(id);
          position: absolute;
          left: 0;
          font-weight: 600;
          color: #2563EB;
        }

        /* Link de retorno da nota */
        .markdown-content :global([id^="fn"] a[href^="#ref"]) {
          font-size: 0.75em;
          margin-left: 0.5em;
          color: #6B7280;
        }

        /* REFERÊNCIAS BIBLIOGRÁFICAS - Estilo ABNT */
        .markdown-content :global(h2):has-text("Referências Bibliográficas"),
        .markdown-content :global(h2):has-text("Referências") {
          margin-top: 4rem;
          padding-top: 2rem;
          border-top: 3px double #D1D5DB;
          font-size: 1.5rem;
          color: #1E3A8A;
        }

        /* Parágrafos de referências - recuo francês ABNT */
        .markdown-content :global(h2:has-text("Referências") + p),
        .markdown-content :global(h2:has-text("Referências Bibliográficas") + p) {
          margin-left: 0;
          padding-left: 2rem;
          text-indent: -2rem;
          margin-bottom: 1rem;
          line-height: 1.5;
          font-size: 0.95rem;
          color: #374151;
        }

        /* Separadores especiais para seções */
        .markdown-content :global(hr) {
          border: none;
          border-top: 3px double #D1D5DB;
          margin: 4rem 0 2rem 0;
        }

        /* Estilos especiais para seções após HR (geralmente notas e referências) */
        .markdown-content :global(hr + h2) {
          margin-top: 2rem;
          font-size: 1.5rem;
          color: #1E3A8A;
          border-top: none;
          padding-top: 0;
        }

        /* Destaque para citações de leis */
        .markdown-content :global(strong):has-text("Lei nº"),
        .markdown-content :global(strong):has-text("Decreto"),
        .markdown-content :global(strong):has-text("Portaria") {
          color: #1E40AF;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customizar renderização de links para notas de rodapé
          a: ({ href, children, ...props }) => {
            if (href?.startsWith('#fn')) {
              return (
                <sup>
                  <a href={href} {...props}>
                    {children}
                  </a>
                </sup>
              );
            }
            return <a href={href} {...props}>{children}</a>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
