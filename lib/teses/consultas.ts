/**
 * A porta única de leitura das teses (spec §8.1).
 *
 * Três superfícies leem daqui — vitrine pública, página do acórdão-líder e
 * acervo restrito — e nenhuma monta `where` por conta própria. Consultas
 * espalhadas divergem, e divergência aqui significa publicar tese que não
 * deveria aparecer.
 */
import { prisma } from '@/lib/prisma';
import { WHERE_ELEGIVEL_BASE, WHERE_ELEGIVEL_VITRINE, evidenciaIntegral } from '@/lib/tcu/elegibilidade-tese';

export type NivelProcedencia = 'oficial' | 'convergencia' | 'sem-colegiado';

export interface TrechoExibido {
  ordem: number;
  trecho: string;
  origemNumero: number;
  origemAno: number;
  origemColegiado: string | null;
  origemUrl: string | null;
  origemLinkPDF: string | null;
  noVoto: boolean;
}

export interface TeseCard {
  enunciadoId: string;
  enunciado: string;
  inovacao: string;
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  nivel: NivelProcedencia;
  citantesConcordantes: number | null;
  citacoesNoVoto: number;
  chaveUrl: string;
  trechos: TrechoExibido[];
}

export interface DetalheAcordao {
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  relatorAlvo: string | null;
  urlAlvo: string | null;
  nivel: NivelProcedencia;
  citantesConcordantes: number | null;
  citacoesNoVoto: number;
  assunto: string;
  /** Teses que este leitor pode ver. */
  teses: TeseCard[];
  /** Quantas existem além dessas, para o bloco de chamada. Zero quando não há. */
  tesesReservadas: number;
}

/**
 * O nível governa o que a tela pode afirmar sobre o colegiado (§4.3).
 * `acordaoKey` manda: ele só é gravado quando o TCU devolve exatamente um
 * candidato, então é o sinal mais forte que existe.
 */
export function nivelDe(d: { acordaoKey: string | null; origemIdentidade: string | null }): NivelProcedencia {
  if (d.acordaoKey) return 'oficial';
  if (d.origemIdentidade === 'convergencia-citantes') return 'convergencia';
  return 'sem-colegiado';
}

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Segmento de URL do acórdão-líder. O colegiado entra apenas quando conhecido:
 * `/teses/2298-2025-plenario` afirmaria no próprio endereço o que a página não
 * afirma no corpo.
 */
export function chaveUrl(d: { numeroAlvo: number; anoAlvo: number; colegiadoAlvo: string | null }): string {
  const base = `${d.numeroAlvo}-${d.anoAlvo}`;
  return d.colegiadoAlvo ? `${base}-${slug(d.colegiadoAlvo)}` : base;
}

const SELECT_ENUNCIADO = {
  id: true,
  enunciado: true,
  inovacao: true,
  trechosFonte: true,
  trechos: {
    orderBy: { ordem: 'asc' as const },
    select: {
      ordem: true, trecho: true, origemNumero: true, origemAno: true,
      origemColegiado: true, origemUrl: true, origemLinkPDF: true,
      origemDocumentId: true, noVoto: true,
    },
  },
} as const;

const SELECT_DESTILACAO = {
  numeroAlvo: true, anoAlvo: true, colegiadoAlvo: true, relatorAlvo: true,
  urlAlvo: true, acordaoKey: true, origemIdentidade: true,
  citantesConcordantes: true, dossieNoVoto: true, assunto: true,
} as const;

type LinhaEnunciado = {
  id: string; enunciado: string; inovacao: string; trechosFonte: unknown;
  trechos: Array<TrechoExibido & { origemDocumentId: string | null }>;
};

function montarCard(e: LinhaEnunciado, d: {
  numeroAlvo: number; anoAlvo: number; colegiadoAlvo: string | null;
  acordaoKey: string | null; origemIdentidade: string | null;
  citantesConcordantes: number | null; dossieNoVoto: number;
}): TeseCard {
  return {
    enunciadoId: e.id,
    enunciado: e.enunciado,
    inovacao: e.inovacao,
    numeroAlvo: d.numeroAlvo,
    anoAlvo: d.anoAlvo,
    colegiadoAlvo: d.colegiadoAlvo,
    nivel: nivelDe(d),
    citantesConcordantes: d.citantesConcordantes,
    citacoesNoVoto: d.dossieNoVoto,
    chaveUrl: chaveUrl(d),
    trechos: e.trechos,
  };
}

async function listar(where: object): Promise<TeseCard[]> {
  const linhas = await prisma.teseEnunciado.findMany({
    where,
    select: { ...SELECT_ENUNCIADO, destilacao: { select: SELECT_DESTILACAO } },
    orderBy: [{ destilacao: { dossieNoVoto: 'desc' } }, { ordem: 'asc' }],
  });
  // A integralidade da evidência não cabe no filtro SQL (compara contagem
  // contra um campo Json), então é conferida aqui. Sem isto, uma tese com
  // fundamentação pela metade chegaria à tela.
  return linhas
    .filter(l => evidenciaIntegral(l as never))
    .map(l => montarCard(l as never, (l as never as { destilacao: never }).destilacao));
}

export function listarVitrine(): Promise<TeseCard[]> {
  return listar({ ...WHERE_ELEGIVEL_VITRINE, publicado: true, vitrinePublica: true });
}

export function listarAcervo(): Promise<TeseCard[]> {
  return listar({ ...WHERE_ELEGIVEL_BASE, publicado: true });
}

export async function buscarPorChave(chave: string, comAcessoAtivo: boolean): Promise<DetalheAcordao | null> {
  const partes = chave.split('-');
  const numeroAlvo = parseInt(partes[0], 10);
  const anoAlvo = parseInt(partes[1], 10);
  if (!Number.isFinite(numeroAlvo) || !Number.isFinite(anoAlvo)) return null;

  const d = await prisma.teseDestilacao.findFirst({
    where: { numeroAlvo, anoAlvo, atual: true },
    select: {
      ...SELECT_DESTILACAO,
      enunciados: {
        where: { ...WHERE_ELEGIVEL_BASE, publicado: true },
        orderBy: { ordem: 'asc' },
        select: { ...SELECT_ENUNCIADO, vitrinePublica: true },
      },
    },
  });
  if (!d) return null;

  const integros = d.enunciados.filter(e => evidenciaIntegral(e as never));
  const visiveis = comAcessoAtivo ? integros : integros.filter(e => e.vitrinePublica);

  return {
    numeroAlvo: d.numeroAlvo,
    anoAlvo: d.anoAlvo,
    colegiadoAlvo: d.colegiadoAlvo,
    relatorAlvo: d.relatorAlvo,
    urlAlvo: d.urlAlvo,
    nivel: nivelDe(d),
    citantesConcordantes: d.citantesConcordantes,
    citacoesNoVoto: d.dossieNoVoto,
    assunto: d.assunto,
    teses: visiveis.map(e => montarCard(e as never, d)),
    tesesReservadas: integros.length - visiveis.length,
  };
}
