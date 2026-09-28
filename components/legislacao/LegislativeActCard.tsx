'use client';

import Link from 'next/link';
import { getTypeLabel, getEsferaLabel } from '@/lib/legislacao/labels';
import { subtituloDoAto, dataPorExtenso, orgaoEmissor } from '@/lib/legislacao/cabecalho';
import { isIdentificacaoDoAto } from '@/lib/legislative-scrapers/extract-ementa';
import type { LegislativeAct } from '@/hooks/use-legislacao';

interface LegislativeActCardProps {
  act: LegislativeAct;
}

/**
 * Data da listagem. O `publishDate` de 1º de janeiro é, quase sempre,
 * preenchimento de ano no cadastro; nesse caso a linha mostra só o ano.
 */
function dataDaLista(publishDate: string): string {
  const d = new Date(publishDate);
  if (Number.isNaN(d.getTime())) return '';
  if (d.getUTCDate() === 1 && d.getUTCMonth() === 0) return String(d.getUTCFullYear());
  return dataPorExtenso(d);
}

/** "arts. 6º, 75 e 82" (ordinal só até o 9), com "+N" além de cinco. */
function artigosDaLei(arts: string[]): string {
  const rotulo = (n: string) => (/^[1-9](-[A-Z])?$/i.test(n) ? n.replace(/^(\d)/, '$1º') : n);
  const ordenados = [...arts].sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
  const shown = ordenados.slice(0, 5).map(rotulo);
  const extra = arts.length - shown.length;
  const lista = shown.length > 1 ? `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}` : shown[0];
  return `Lei 14.133/2021, ${arts.length > 1 ? 'arts.' : 'art.'} ${lista}${extra > 0 ? ` (+${extra})` : ''}`;
}

// Itens das abas "Outros atos" e "Orientações" vêm da tabela de documentos:
// o tipo é genérico e a data é a do cadastro no site, não a do ato.
const DOCUMENT_TYPES = new Set(['boa_pratica', 'orientacao_procedimento']);

/**
 * Linha da listagem de /legislacao: número do ato como título, nome
 * descritivo, ementa em até duas linhas e uma linha de metadados. Os detalhes
 * (resumo didático, relações, texto integral) ficam na página do ato.
 */
export function LegislativeActCard({ act }: LegislativeActCardProps) {
  const fromDocument = DOCUMENT_TYPES.has(act.type);
  const typeLabel = getTypeLabel(act.type);
  const heading = act.fullNumber || act.title;
  const subtitulo = act.fullNumber ? subtituloDoAto(act.title) : null;
  const showType =
    !fromDocument && Boolean(act.fullNumber) && !act.fullNumber!.toLowerCase().startsWith(typeLabel.toLowerCase());
  const ementa = act.ementa?.trim();
  const showEmenta = Boolean(ementa) && ementa !== subtitulo && ementa !== act.title && !isIdentificacaoDoAto(ementa);

  const meta = [
    orgaoEmissor(act.issuer),
    fromDocument ? null : dataDaLista(act.publishDate),
    act.esfera && act.esfera !== 'federal' ? getEsferaLabel(act.esfera) : null,
  ].filter(Boolean);

  return (
    <article id={act.id} className="py-5 border-b border-border-subtle last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-base sm:text-lg font-semibold text-ink-primary">
          <Link href={`/legislacao/${act.id}`} className="hover:text-brand-700 hover:underline underline-offset-2">
            {heading}
          </Link>
        </h2>
        {showType && <span className="text-sm text-ink-muted">{typeLabel}</span>}
      </div>

      {subtitulo && <p className="text-ink-primary mt-0.5">{subtitulo}</p>}

      {showEmenta && (
        <p className="text-sm text-ink-secondary mt-1 line-clamp-2 max-w-[75ch]">{ementa}</p>
      )}

      {(meta.length > 0 || act.leiArticles.length > 0) && (
        <p className="text-sm text-ink-muted mt-1.5">
          {meta.join(' · ')}
          {meta.length > 0 && act.leiArticles.length > 0 && ' · '}
          {act.leiArticles.length > 0 && artigosDaLei(act.leiArticles)}
        </p>
      )}
    </article>
  );
}
