import type { Metadata } from 'next';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import { rotuloArtigo } from '@/lib/legislacao/cabecalho';

/**
 * Metadados de cada artigo da Lei 14.133/2021 exibido em /lei-14133?artigo=N.
 *
 * Cada artigo tem título, descrição e canonical próprios, para que os
 * buscadores o indexem separadamente. Sem isso, as 196 URLs do sitemap
 * redirecionavam para /lei-14133 e desembocavam num único canonical.
 */

const NUMERO_VALIDO = /^\d+(-[A-Z])?$/;
const LIMITE_DESCRICAO = 155;

/**
 * Os arts. 337-E a 337-P são do Código Penal (incluídos pelo art. 178 desta
 * Lei) e não fazem parte da base de artigos exibida na página.
 */
function doCodigoPenal(numero: string): boolean {
  return numero.startsWith('337-');
}

export function artigoIndexavel(numero: string): boolean {
  return NUMERO_VALIDO.test(numero) && !doCodigoPenal(numero) && numero in LEI_14133_ARTIGOS;
}

export function artigosIndexaveis(): string[] {
  return Object.keys(LEI_14133_ARTIGOS).filter(artigoIndexavel);
}

export function urlDoArtigo(numero: string): string {
  return `/lei-14133?artigo=${encodeURIComponent(numero)}`;
}

/**
 * Início do texto do artigo, sem o rótulo ("Art. 75.", "Art. 10º" — os dados
 * estáticos trazem ordinais inconsistentes) e cortado em palavra inteira.
 */
export function descricaoDoArtigo(numero: string): string {
  const texto = LEI_14133_ARTIGOS[numero]?.ementa ?? '';
  const corpo = texto
    .replace(/^\s*Art\.\s*\d+(?:-[A-Z])?\s*[º°o]?\s*\.?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (corpo.length <= LIMITE_DESCRICAO) return corpo;
  const corte = corpo.slice(0, LIMITE_DESCRICAO);
  const ultimoEspaco = corte.lastIndexOf(' ');
  return `${(ultimoEspaco > 80 ? corte.slice(0, ultimoEspaco) : corte).replace(/[,;:\s]+$/, '')}…`;
}

/** Metadados do artigo, ou null quando o parâmetro não é um artigo indexável. */
export function metadadosDoArtigo(numero: string | undefined): Metadata | null {
  if (!numero || !artigoIndexavel(numero)) return null;
  return {
    title: `${rotuloArtigo(numero)} da Lei 14.133/2021`,
    description: descricaoDoArtigo(numero),
    alternates: { canonical: urlDoArtigo(numero) },
  };
}
