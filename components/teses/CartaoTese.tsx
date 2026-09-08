import Link from 'next/link';
import { Quote, ExternalLink } from 'lucide-react';
import type { TeseCard } from '@/lib/teses/consultas';

/**
 * O cartão da tese, usado nas três superfícies (spec §8.1).
 *
 * Duas regras governam o que ele pode mostrar. A primeira é a procedência
 * (§4.3): o colegiado só é afirmado quando o TCU o confirmou; na convergência
 * vem com a contagem de votos que o sustentam, e sem identidade não vem. A
 * segunda é a evidência (§7.1): o primeiro trecho-fonte fica visível, não atrás
 * de um clique, e todo trecho leva ao inteiro teor do acórdão que o escreveu.
 */
export default function CartaoTese({ tese }: { tese: TeseCard }) {
  const [primeiro, ...demais] = tese.trechos;

  const procedencia =
    tese.nivel === 'oficial'
      ? tese.colegiadoAlvo
      : tese.nivel === 'convergencia'
        ? `${tese.colegiadoAlvo}, segundo os votos de ${tese.citantesConcordantes} acórdãos citantes que o informam`
        : 'Colegiado não identificado';

  return (
    <article className="bg-white rounded-[6px] border border-border-subtle p-5 hover:border-brand-300 transition-colors">
      <p className="text-ink-primary leading-relaxed">{tese.enunciado}</p>

      <div className="flex items-center gap-2 mt-3 flex-wrap text-sm">
        <Link
          href={`/teses/${tese.chaveUrl}`}
          className="font-semibold text-brand-700 hover:text-brand-600 transition-colors"
        >
          {`Acórdão ${tese.numeroAlvo}/${tese.anoAlvo}`}
        </Link>
        {procedencia && <span className="text-ink-muted">{procedencia}</span>}
        <span className="px-2 py-0.5 rounded-[3px] text-xs font-medium bg-surface-deep text-ink-muted">
          {`${tese.citacoesNoVoto} citações no voto`}
        </span>
      </div>

      {tese.inovacao && (
        <p className="text-sm text-ink-muted mt-2">{tese.inovacao}</p>
      )}

      {primeiro && (
        <figure className="mt-4 border-l-2 border-brand-200 pl-4">
          <Quote className="w-4 h-4 text-brand-400 mb-1" aria-hidden="true" />
          <blockquote className="text-sm text-ink-primary italic">{primeiro.trecho}</blockquote>
          <figcaption className="mt-1 text-xs text-ink-muted">
            <a
              href={primeiro.origemUrl ?? primeiro.origemLinkPDF ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-500 transition-colors"
            >
              {`Acórdão ${primeiro.origemNumero}/${primeiro.origemAno}`}
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            {primeiro.noVoto ? ' — citado no voto' : ' — citado no acórdão'}
          </figcaption>
        </figure>
      )}

      {demais.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-brand-700 hover:text-brand-600 transition-colors">
            {demais.length === 1 ? 'Mais um trecho-fonte' : `Mais ${demais.length} trechos-fonte`}
          </summary>
          <div className="mt-3 space-y-4">
            {demais.map((t) => (
              <figure key={t.ordem} className="border-l-2 border-border-subtle pl-4">
                <blockquote className="text-sm text-ink-primary italic">{t.trecho}</blockquote>
                <figcaption className="mt-1 text-xs text-ink-muted">
                  <a
                    href={t.origemUrl ?? t.origemLinkPDF ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-500 transition-colors"
                  >
                    {`Acórdão ${t.origemNumero}/${t.origemAno}`}
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                  {t.noVoto ? ' — citado no voto' : ' — citado no acórdão'}
                </figcaption>
              </figure>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}
