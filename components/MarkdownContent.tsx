'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFirstText(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    for (const c of children) {
      const t = extractFirstText(c);
      if (t) return t;
    }
  }
  if (children?.props?.children) return extractFirstText(children.props.children);
  return '';
}

/**
 * remark plugin: transforma diretivas (:::alteracao, :omitido, :nr, :::signature)
 * em nós HTML com data attributes que o renderer customizado abaixo intercepta.
 */
function remarkLegalDirectives() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree, (node: any) => {
      if (
        node.type === 'containerDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'textDirective'
      ) {
        const data = node.data || (node.data = {});
        const tagName =
          node.type === 'textDirective' ? 'span' : 'div';
        data.hName = tagName;
        data.hProperties = {
          className: `${node.name}-directive`,
        };
      }
    });
  };
}

interface MarkdownContentProps {
  content: string;
  variant?: 'planalto';
}

export default function MarkdownContent({ content, variant }: MarkdownContentProps) {
  const wrapperClassName = variant === 'planalto'
    ? 'markdown-content markdown-content--planalto'
    : 'markdown-content';
  return (
    <div className={wrapperClassName}>
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

        /* === VARIANTE PLANALTO ===================================== */

        .markdown-content--planalto {
          --planalto-vinho: #7a1c1c;
          --planalto-link:  #1d4ed8;
          font-family: var(--font-lora), Georgia, 'Times New Roman', serif;
          font-size: 1.0625rem;
          line-height: 1.65;
          color: #1f2937;
        }

        /* Título oficial (H1) — centralizado, vinho, underline */
        .markdown-content--planalto :global(h1) {
          text-align: center;
          color: var(--planalto-vinho);
          font-weight: 700;
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 4px;
          font-size: 1.5rem;
          margin: 2.5rem auto 2rem;
          padding: 0;
          border: none;
          line-height: 1.4;
        }

        /* Ementa = primeiro <p> após H1 → lateral à direita, vinho itálico */
        .markdown-content--planalto :global(h1 + p) {
          width: 65%;
          margin-left: auto;
          margin-right: 0;
          color: var(--planalto-vinho);
          font-style: italic;
          font-size: 0.95rem;
          text-align: justify;
          text-indent: 0;
        }

        /* H2 — CAPÍTULO/TÍTULO/ANEXO centralizado */
        .markdown-content--planalto :global(h2) {
          text-align: center;
          text-transform: uppercase;
          color: rgba(122, 28, 28, 0.85);
          font-size: 1.15rem;
          font-weight: 700;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
        }

        /* H3/H4 — SEÇÃO/SUBSEÇÃO centralizado */
        .markdown-content--planalto :global(h3),
        .markdown-content--planalto :global(h4) {
          text-align: center;
          font-weight: 700;
          color: #374151;
          font-size: 1rem;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
        }

        /* Parágrafos — recuo de primeira linha (Art./§) */
        .markdown-content--planalto :global(p) {
          text-indent: 2em;
          text-align: justify;
          hyphens: auto;
          margin-bottom: 0.85rem;
          line-height: 1.65;
        }

        /* Inciso (classe injetada pelo custom <p>) */
        .markdown-content--planalto :global(p.inciso) {
          padding-left: 2em;
          text-indent: 0;
        }

        /* Alínea */
        .markdown-content--planalto :global(p.alinea) {
          padding-left: 4em;
          text-indent: 0;
        }

        /* Bloco :::alteracao — recuo lateral + borda esquerda */
        .markdown-content--planalto :global(.alteracao-block) {
          margin: 1.25rem 0 1.25rem 2.5rem;
          padding-left: 1rem;
          border-left: 2px solid #d1d5db;
          font-size: 0.97rem;
        }
        .markdown-content--planalto :global(.alteracao-block p) {
          text-indent: 1.5em;
        }
        .markdown-content--planalto :global(.alteracao-block p.inciso) {
          padding-left: 1.5em;
        }
        .markdown-content--planalto :global(.alteracao-block p.alinea) {
          padding-left: 3em;
        }

        /* Omitido inline — linha pontilhada CSS */
        .markdown-content--planalto :global(.omitido-line)::before {
          content: '';
          display: inline-block;
          width: 60%;
          border-bottom: 1px dotted #9ca3af;
          vertical-align: middle;
          margin: 0 0.25em;
        }

        /* (NR) discreto */
        .markdown-content--planalto :global(.nr) {
          font-size: 0.85em;
          color: #6b7280;
          margin-left: 0.25em;
        }

        /* Assinatura centralizada */
        .markdown-content--planalto :global(.signature-block) {
          text-align: center;
          margin: 3rem 0;
          line-height: 2;
        }
        .markdown-content--planalto :global(.signature-block p) {
          text-indent: 0;
          text-align: center;
        }

        /* Links no tom Planalto */
        .markdown-content--planalto :global(a) {
          color: var(--planalto-link);
          text-decoration: underline;
        }

        /* Strong herda vinho discreto, sem ficar gritante */
        .markdown-content--planalto :global(strong) {
          color: #111827;
        }

        /* Mobile (< 640px) */
        @media (max-width: 640px) {
          .markdown-content--planalto :global(h1) {
            font-size: 1.15rem;
          }
          .markdown-content--planalto :global(h1 + p) {
            width: 100%;
          }
          .markdown-content--planalto :global(.alteracao-block) {
            margin-left: 1rem;
          }
          .markdown-content--planalto :global(p.inciso) {
            padding-left: 1.25em;
          }
          .markdown-content--planalto :global(p.alinea) {
            padding-left: 2.5em;
          }
          .markdown-content--planalto :global(.omitido-line)::before {
            width: 40%;
          }
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkDirective, remarkLegalDirectives]}
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            div: ({ className, children, ...props }: any) => {
              if (className?.includes('alteracao-directive')) {
                return <div className="alteracao-block">{children}</div>;
              }
              if (className?.includes('signature-directive')) {
                return <div className="signature-block">{children}</div>;
              }
              return <div className={className} {...props}>{children}</div>;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            span: ({ className, children, ...props }: any) => {
              if (className?.includes('omitido-directive')) {
                return <span className="omitido-line" aria-label="Trecho não alterado" />;
              }
              if (className?.includes('nr-directive')) {
                return <span className="nr">{children}</span>;
              }
              return <span className={className} {...props}>{children}</span>;
            },
            // Custom <p>: detecta inciso/alínea pelo primeiro filho de texto
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            p: ({ children, ...props }: any) => {
              const firstText = extractFirstText(children);
              let className: string | undefined;
              if (/^[IVXLCDM]+\s*[-–—]\s/.test(firstText)) {
                className = 'inciso';
              } else if (/^[a-z]\)\s/.test(firstText)) {
                className = 'alinea';
              }
              return <p className={className} {...props}>{children}</p>;
            },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
