/**
 * Histórico do texto integral dos atos normativos (model LegislativeActVersion).
 *
 * Todo caminho que troca o `content` de um ato guarda antes o texto que sai:
 * cron check-legislative-updates, verificação e edição no admin e
 * reimportação (scrape-and-index). A comparação fica em comparar-textos.ts.
 */
import { prisma } from '@/lib/prisma';
import { computeHash } from '@/lib/legislative-scrapers/change-detector';
import { compararTextos, type Comparacao } from './comparar-textos';

export type OrigemDaVersao = 'cron' | 'admin-raspagem' | 'admin-edicao' | 'reimportacao';

export interface TextoAtual {
  id: string;
  content: string | null;
  contentHash?: string | null;
  changeDetectedAt?: Date | null;
  createdAt?: Date | null;
}

/**
 * Criação da versão superada, para entrar na mesma transação que grava o
 * texto novo. Null quando não há texto a guardar ou quando o novo é igual.
 */
export function guardarVersaoSuperada(atual: TextoAtual, novoConteudo: string | null | undefined, origem: OrigemDaVersao) {
  if (!atual.content?.trim()) return null;
  if (novoConteudo != null && computeHash(novoConteudo) === computeHash(atual.content)) return null;
  return prisma.legislativeActVersion.create({
    data: {
      actId: atual.id,
      content: atual.content,
      contentHash: atual.contentHash ?? computeHash(atual.content),
      textSince: atual.changeDetectedAt ?? atual.createdAt ?? null,
      source: origem,
    },
  });
}

export interface AlteracaoDoTexto {
  versaoId: string;
  /** Quando o texto passou a ser o seguinte. */
  em: Date;
  /** Desde quando o texto superado estava no site. */
  textoDesde: Date | null;
  origem: string;
  comparacao: Comparacao;
}

/** Quantas versões a página e o admin examinam, das mais recentes. */
const MAX_VERSOES = 20;

/**
 * Alterações do texto, da mais recente para a mais antiga: cada versão
 * guardada comparada com o texto que a substituiu (a versão seguinte ou o
 * texto atual).
 */
export async function alteracoesDoTexto(actId: string, conteudoAtual: string | null): Promise<AlteracaoDoTexto[]> {
  const versoes = await prisma.legislativeActVersion.findMany({
    where: { actId },
    orderBy: { replacedAt: 'desc' },
    take: MAX_VERSOES,
    select: { id: true, content: true, textSince: true, replacedAt: true, source: true },
  });
  let depois = conteudoAtual;
  return versoes.map((v) => {
    const comparacao = compararTextos(v.content, depois);
    depois = v.content;
    return { versaoId: v.id, em: v.replacedAt, textoDesde: v.textSince, origem: v.source, comparacao };
  });
}

/** A alteração de texto mais recente que não foi só de apresentação. */
export async function ultimaAlteracaoDoTexto(actId: string, conteudoAtual: string | null): Promise<Date | null> {
  const ultima = await prisma.legislativeActVersion.findFirst({
    where: { actId },
    orderBy: { replacedAt: 'desc' },
    select: { id: true },
  });
  if (!ultima) return null;
  const alteracoes = await alteracoesDoTexto(actId, conteudoAtual);
  return alteracoes.find((a) => !a.comparacao.soFormatacao)?.em ?? null;
}
