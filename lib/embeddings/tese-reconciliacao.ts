/**
 * Reconciliação do índice das teses (spec §9).
 *
 * NÃO é uma lista de eventos: é uma consulta pelo predicado canônico, dos dois
 * lados. Indexa o elegível sem chunk e apaga o chunk de quem deixou de ser
 * elegível. Assim, uma transição feita por SQL direto no banco, ou por um
 * script que esqueceu de marcar `embeddingStatus`, também é capturada.
 *
 * `publicado` e `vitrinePublica` NÃO entram aqui: são filtro de leitura, não
 * critério de indexação. Um mesmo chunk serve vitrine e acervo, e é a consulta
 * que decide o que enxerga. Indexar duas vezes duplicaria o vetor só para
 * variar o predicado.
 */
import { prisma } from '@/lib/prisma';
import { WHERE_ELEGIVEL_BASE, evidenciaIntegral } from '@/lib/tcu/elegibilidade-tese';
import { processTeseEnunciado } from './tese-processor';

const LOTE_PADRAO = 50;

export async function reconciliarTeses(
  opcoes: { limite?: number } = {},
): Promise<{ indexados: number; apagados: number; falhas: number }> {
  const limite = opcoes.limite ?? LOTE_PADRAO;

  // Uma consulta só, na forma positiva do predicado, e a integralidade da
  // evidência conferida em memória, como fazem os demais consumidores.
  //
  // A integralidade vale para os DOIS lados. Na indexação, porque o enunciado
  // com evidência incompleta é recusado pelo processador sem ganhar chunk: se
  // ele entrasse na fila, voltaria a ela a cada rodada e, passando de 50,
  // ocuparia o lote inteiro e impediria a indexação das teses válidas. Na
  // limpeza, porque a evidência pode se perder depois da indexação (o
  // `Document` do citante é `onDelete: SetNull`), e o chunk de tese que
  // ninguém consegue conferir não pode continuar sendo recuperado.
  const candidatos = await prisma.teseEnunciado.findMany({
    where: WHERE_ELEGIVEL_BASE,
    select: {
      id: true,
      trechosFonte: true,
      trechos: {
        select: { ordem: true, origemDocumentId: true, origemUrl: true, origemLinkPDF: true },
      },
      chunk: { select: { id: true } },
    },
  });
  const validas = candidatos.filter((c) => evidenciaIntegral(c));

  const pendentes = validas.filter((v) => !v.chunk).slice(0, limite);

  let indexados = 0;
  let falhas = 0;
  for (const p of pendentes) {
    const r = await processTeseEnunciado(p.id);
    if (r.success) indexados++;
    else falhas++;
  }

  // O delete não usa a negação do predicado, `{ enunciado: { NOT: ... } }`.
  // O predicado tem quatro conjunções, duas delas sobre tabelas relacionadas,
  // e a semântica dessa negação depende de como o Prisma traduz cada pedaço.
  // Se ela ficasse rigorosa demais, o cron apagaria a cada rodada o chunk de
  // teses válidas: elas sumiriam da busca, seriam reindexadas na rodada
  // seguinte pagando embedding, sumiriam de novo: um moinho silencioso, sem
  // erro nem log. Aqui o delete se lê em voz alta: apague o que não está na
  // lista dos válidos.
  const { count: apagados } = await prisma.teseEnunciadoChunk.deleteMany({
    where: { enunciadoId: { notIn: validas.map((v) => v.id) } },
  });

  return { indexados, apagados, falhas };
}
