/**
 * ArticleFull — UM artigo da Lei com texto INTEGRAL.
 *
 * Tipografia jurídica:
 * - Texto justificado com hyphenation (padrão de leis impressas)
 * - Ordinal "º" só nos artigos 1º a 9º (do 10 em diante usa cardinal)
 * - Incisos/alíneas em hanging indent (numeral em coluna fixa, texto alinhado
 *   independentemente da largura do numeral romano)
 * - Parágrafos § sem decoração lateral (apenas recuo)
 */

import Link from 'next/link';
import { ExternalLink, Scale, FileText, AlertTriangle } from 'lucide-react';
import type { ArticleCounts } from '@/lib/lei-14133/queries';
import { normalizeEmenta, stripArticlePrefix, isLikelyTruncated } from '@/lib/lei-14133/parse-ementa';

const PLANALTO_LEI_URL =
  'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm';

interface ArticleFullProps {
  numero: string;
  ementa: string;
  counts?: ArticleCounts;
  withDropCap?: boolean;
  /**
   * Se o cabeçalho "Art. N" leva à página do artigo. Falso quando o leitor já
   * está nele — um link para a própria página só gera navegação inútil.
   */
  comLink?: boolean;
}

const INCISO_REGEX = /^([IVXLCDM]{1,5})\s+[-–—]\s+([\s\S]+)$/;
const ALINEA_REGEX = /^([a-z])\)\s+([\s\S]+)$/;
const PARAGRAFO_REGEX = /^(§\s*\d+(?:º|o)?(?:-[A-Z])?\.?|Parágrafo único\.)\s*([\s\S]+)$/;

/** Em PT-BR jurídico, ordinal só vai até 9º. Do 10 em diante, cardinal. */
function shouldUseOrdinal(numero: string): boolean {
  const m = numero.match(/^(\d+)/);
  if (!m) return false;
  return parseInt(m[1], 10) <= 9;
}

export function ArticleFull({ numero, ementa, counts, withDropCap, comLink = true }: ArticleFullProps) {
  const cleaned = stripArticlePrefix(ementa);
  const normalized = normalizeEmenta(cleaned);
  const truncated = isLikelyTruncated(normalized);

  const paragraphs = normalized.split('\n\n').map((p) => p.trim()).filter(Boolean);
  const acordaos = counts?.acordaos ?? 0;
  const pareceresOns = counts?.pareceresOns ?? 0;

  // Drop cap só no primeiro parágrafo do primeiro artigo do capítulo, se
  // o caput tem mais de 40 chars (evita drop cap em "Esta Lei aplica-se a:")
  const useDropCap = withDropCap && paragraphs[0] && paragraphs[0].length > 40;
  const firstParagraph = paragraphs[0] || '';
  const restParagraphs = paragraphs.slice(1);

  function renderParagraph(p: string, key: string | number, isCaput = false) {
    if (isCaput) {
      return (
        <p key={key} className="mb-4 text-justify hyphens-auto">
          {p}
        </p>
      );
    }

    const inciso = p.match(INCISO_REGEX);
    if (inciso) {
      return (
        <div key={key} className="mb-2 flex gap-3 pl-4">
          <span className="flex-shrink-0 w-12 pt-[0.05em] text-right font-medium tabular-nums text-ink-secondary">
            {inciso[1]} —
          </span>
          <p className="flex-1 text-justify hyphens-auto text-ink-secondary">
            {inciso[2]}
          </p>
        </div>
      );
    }

    const alinea = p.match(ALINEA_REGEX);
    if (alinea) {
      return (
        <div key={key} className="mb-2 flex gap-2 pl-16">
          <span className="flex-shrink-0 w-5 pt-[0.05em] text-right font-medium text-ink-secondary">
            {alinea[1]})
          </span>
          <p className="flex-1 text-justify hyphens-auto text-ink-secondary">
            {alinea[2]}
          </p>
        </div>
      );
    }

    const paragrafo = p.match(PARAGRAFO_REGEX);
    if (paragrafo) {
      return (
        <p
          key={key}
          className="mb-3 pl-4 text-justify hyphens-auto text-ink-secondary"
        >
          <span className="font-medium text-ink-primary">{paragrafo[1]}</span>{' '}
          {paragrafo[2]}
        </p>
      );
    }

    return (
      <p key={key} className="mb-3 last:mb-0 text-justify hyphens-auto">
        {p}
      </p>
    );
  }

  return (
    <article
      id={`art-${numero}`}
      className="scroll-mt-24 py-7 border-b border-border-subtle last:border-b-0"
    >
      {/* Header do artigo: numeral em destaque. O endereço é o canônico
          /lei-14133?artigo=N — /artigo/N é só um 301 para cá e custa um salto. */}
      {comLink ? (
        <Link
          href={`/lei-14133?artigo=${numero}`}
          className="inline-block mb-3 group"
          aria-label={`Página dedicada do artigo ${numero}`}
        >
          <span className="font-serif text-2xl font-semibold text-ink-primary group-hover:text-amber-accent-deep transition-colors">
            Art. {numero}
            {shouldUseOrdinal(numero) && <span className="text-ink-muted">º</span>}
          </span>
        </Link>
      ) : (
        <h2 className="font-serif text-2xl font-semibold text-ink-primary mb-3">
          Art. {numero}
          {shouldUseOrdinal(numero) && <span className="text-ink-muted">º</span>}
        </h2>
      )}

      {/* Texto integral renderizado */}
      <div className="font-reading text-ink-primary leading-[1.75] text-[1.0625rem]">
        {/* Caput com drop cap opcional */}
        {useDropCap ? (
          <p className="mb-4 text-justify hyphens-auto">
            <span
              className="float-left font-serif font-semibold text-ink-primary mr-2"
              style={{ fontSize: '3.5rem', lineHeight: 0.85, marginTop: '0.1em' }}
              aria-hidden="true"
            >
              {firstParagraph[0]}
            </span>
            <span aria-label={firstParagraph}>{firstParagraph.slice(1)}</span>
          </p>
        ) : (
          renderParagraph(firstParagraph, 'caput', true)
        )}

        {/* Demais parágrafos (incisos, alíneas, §s) */}
        {restParagraphs.map((p, i) => renderParagraph(p, i))}
      </div>

      {/* Aviso de texto truncado */}
      {truncated && (
        <div className="mt-4 inline-flex items-start gap-2 px-3 py-2 bg-amber-accent-soft border-l-4 border-amber-accent rounded-r text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-accent-deep flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-sans font-medium text-amber-accent-deep">Texto incompleto.</span>{' '}
            <a
              href={PLANALTO_LEI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-amber-accent-deep underline hover:text-amber-accent"
            >
              Ver texto integral no Planalto →
            </a>
          </div>
        </div>
      )}

      {/* Refs e link planalto */}
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
        {acordaos > 0 && (
          <Link
            href={`/lei-14133?artigo=${numero}#jurisprudencia`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-accent-soft text-ink-primary font-sans font-medium rounded hover:bg-amber-accent hover:text-surface-page transition-colors"
          >
            <Scale className="w-3 h-3" aria-hidden="true" />
            {acordaos} {acordaos === 1 ? 'acórdão' : 'acórdãos'}
          </Link>
        )}
        {pareceresOns > 0 && (
          <Link
            href={`/lei-14133?artigo=${numero}#pareceres`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-accent-soft text-ink-primary font-sans font-medium rounded hover:bg-amber-accent hover:text-surface-page transition-colors"
          >
            <FileText className="w-3 h-3" aria-hidden="true" />
            {pareceresOns} {pareceresOns === 1 ? 'parecer/ON' : 'pareceres/ONs'}
          </Link>
        )}
        <a
          href={PLANALTO_LEI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 ml-auto text-ink-muted hover:text-ink-primary font-sans"
        >
          planalto.gov.br
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
