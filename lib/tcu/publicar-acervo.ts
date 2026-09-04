/**
 * A passagem editorial que liga o acervo restrito (spec §10.1).
 *
 * `publicado` nasce false, então sem este passo as rotas da Onda 3 existiriam
 * sem nada para mostrar. Não exige conferência individual: o acervo é material
 * de trabalho para quem tem acesso ativo, exibido com a evidência ao lado, e a
 * curadoria caso a caso é justamente o que não escala. A vitrine pública, essa
 * sim, exige (§10.2) — e é a Onda 3.
 */
import { prisma } from '../prisma';
import { WHERE_ELEGIVEL_BASE, evidenciaIntegral } from './elegibilidade-tese';

export interface ResultadoSelecao {
  publicaveis: string[];
  foraPorMotivo: Record<string, number>;
}

export async function selecionarParaPublicar(): Promise<ResultadoSelecao> {
  // O filtro SQL cobre veredito, retirada, versão atual e "tem algum trecho";
  // a integralidade da evidência não cabe em Prisma (compara contagem contra um
  // campo Json) e é conferida em memória logo abaixo.
  const candidatos = await prisma.teseEnunciado.findMany({
    where: { ...WHERE_ELEGIVEL_BASE, publicado: false },
    select: {
      id: true,
      trechosFonte: true,
      trechos: {
        select: { ordem: true, origemDocumentId: true, origemUrl: true, origemLinkPDF: true },
      },
    },
  });

  const publicaveis: string[] = [];
  const foraPorMotivo: Record<string, number> = {};
  const contar = (motivo: string) => {
    foraPorMotivo[motivo] = (foraPorMotivo[motivo] ?? 0) + 1;
  };

  for (const c of candidatos) {
    if (!evidenciaIntegral(c)) {
      contar('evidência incompleta');
      continue;
    }
    publicaveis.push(c.id);
  }

  return { publicaveis, foraPorMotivo };
}
