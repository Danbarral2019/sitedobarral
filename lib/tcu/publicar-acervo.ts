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

/** Evidência de um enunciado, o mínimo que `evidenciaIntegral` precisa ler. */
const SELECT_EVIDENCIA = {
  trechosFonte: true,
  trechos: {
    select: { ordem: true, origemDocumentId: true, origemUrl: true, origemLinkPDF: true },
  },
} as const;

export async function selecionarParaPublicar(): Promise<ResultadoSelecao> {
  // -------------------------------------------------------------------------
  // Conjunto de INCLUSÃO — sai do predicado canônico, sem reescrita à mão.
  //
  // O filtro SQL cobre veredito, retirada, versão atual e "tem algum trecho";
  // a integralidade da evidência não cabe em Prisma (compara contagem contra um
  // campo Json) e é conferida em memória logo abaixo. Ordem estável para que
  // `--limit N` publique um lote reprodutível.
  // -------------------------------------------------------------------------
  const candidatos = await prisma.teseEnunciado.findMany({
    where: { ...WHERE_ELEGIVEL_BASE, publicado: false },
    orderBy: [{ destilacaoId: 'asc' }, { ordem: 'asc' }],
    select: { id: true, ...SELECT_EVIDENCIA },
  });

  const publicaveis: string[] = [];
  const foraPorMotivo: Record<string, number> = {};
  const contar = (motivo: string) => {
    foraPorMotivo[motivo] = (foraPorMotivo[motivo] ?? 0) + 1;
  };

  const elegiveisSql = new Set<string>();
  for (const c of candidatos) {
    elegiveisSql.add(c.id);
    if (!evidenciaIntegral(c)) {
      contar('evidência incompleta');
      continue;
    }
    publicaveis.push(c.id);
  }

  // -------------------------------------------------------------------------
  // Conjunto de RELATÓRIO (spec §10.1) — por que os demais ficaram de fora.
  //
  // A consulta de inclusão acima filtra veredito, retirada e versão superada no
  // SQL, então essas exclusões nunca chegariam ao contador: sozinha, ela só
  // consegue relatar 'evidência incompleta'. Num portão editorial esse é
  // justamente o número que se olha antes de apertar `--executar`, e mostrar um
  // quarto do quadro sem dizer que é um quarto é pior do que não mostrar nada.
  //
  // A consulta é propositalmente `{ publicado: false }` puro, e NÃO
  // `NOT: WHERE_ELEGIVEL_BASE`: o `NOT` do Prisma vira `NOT (...)` em SQL, e a
  // lógica de três valores do Postgres descartaria justamente as linhas com
  // `veredito` NULL, que são um dos motivos que se quer contar.
  //
  // Isto é diagnóstico, não uma segunda definição de elegibilidade: quem entra
  // em `publicaveis` é decidido acima, pelo predicado canônico.
  // -------------------------------------------------------------------------
  const naoPublicados = await prisma.teseEnunciado.findMany({
    where: { publicado: false },
    select: {
      id: true,
      veredito: true,
      retiradoEm: true,
      destilacao: { select: { atual: true } },
      ...SELECT_EVIDENCIA,
    },
  });

  // ORDEM DE CLASSIFICAÇÃO (documentada porque um enunciado pode falhar por
  // mais de um motivo e o contador tem de atribuí-lo a um só, previsivelmente):
  // do mais abrangente para o mais específico — versão superada (a destilação
  // inteira está obsoleta, o estado dos enunciados dela é irrelevante), depois
  // retirada editorial (decisão explícita sobre aquele enunciado), depois o
  // veredito, e por último a evidência.
  for (const e of naoPublicados) {
    if (elegiveisSql.has(e.id)) continue; // já contabilizado acima
    if (e.destilacao.atual === false) { contar('versão superada'); continue; }
    if (e.retiradoEm !== null) { contar('retirada editorial'); continue; }
    if (e.veredito !== 'fiel') { contar('veredito ausente ou reprovado'); continue; }
    if (!evidenciaIntegral(e)) { contar('evidência incompleta'); continue; }
    // Não deve ocorrer: significa que `WHERE_ELEGIVEL_BASE` ganhou uma cláusula
    // que esta classificação não espelha. Balde explícito, em vez de atribuição
    // errada silenciosa — é o detector de deriva entre as duas.
    contar('inelegível por motivo não classificado');
  }

  return { publicaveis, foraPorMotivo };
}
