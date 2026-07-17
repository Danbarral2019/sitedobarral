import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { catalogarAcordao } from '@/lib/tcu/catalogar-acordao';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

/**
 * Cron: catalogação contínua do inteiro teor dos acórdãos do TCU.
 *
 * Fecha o fluxo que o sync-tcu-acordaos deixa aberto: ele importa o acórdão
 * com o tcuLinkPDF mas não busca o inteiro teor. Este cron varre a fila de
 * acórdãos ainda não catalogados e processa um lote por execução.
 *
 * Fila: tcuAnalise IS NULL + tcuLinkPDF NOT NULL + tcuAnaliseTentativas < 3.
 * O limite de tentativas impede retentar eternamente falhas permanentes (ata
 * >20 MB, não-RTF). Ao corrigir a extração (ex.: um bug do parser), resetar o
 * contador dos afetados os traz de volta à fila:
 *   UPDATE "Document" SET "tcuAnaliseTentativas" = 0
 *   WHERE "tcuEnriquecimentoErro" ILIKE '%<causa corrigida>%';
 *
 * Ref.: docs/superpowers/specs/2026-07-16-tcu-catalogacao-continua-design.md
 */

// Lote de 30, mas o tempo por acórdão varia (spec: 1-15s + 1s de delay) —
// um lote cheio de acórdãos grandes passaria de 240s "esperados". Por isso
// TIME_BUDGET_MS interrompe o loop com folga antes do maxDuration de 300s;
// o resto do lote fica na fila e é retomado sozinho no próximo run.
export const maxDuration = 300;

const LOTE = 30;
const MAX_TENTATIVAS = 3;
const DELAY_MS = 1000; // 1 req/s — educado com o TCU (sem rate limit documentado)
const TIME_BUDGET_MS = 250_000; // teto de segurança abaixo do maxDuration de 300s

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown> = {};

  await withCronTelemetry('catalog-tcu-inteiro-teor', async () => {
    const alvos = await prisma.document.findMany({
      where: {
        category: 'acordao',
        // ⚠️ `tcuAnalise` é Json?. Em filtro de nulo de campo Json, `null` puro
        // NÃO casa o NULL do banco (retorna 0). Tem que ser `Prisma.DbNull`.
        tcuAnalise: { equals: Prisma.DbNull },
        tcuLinkPDF: { not: null },
        tcuAnaliseTentativas: { lt: MAX_TENTATIVAS },
      },
      select: { id: true, title: true, tcuLinkPDF: true, leiArticlesArr: true },
      orderBy: [{ tcuAnaliseTentativas: 'asc' }, { id: 'asc' }],
      take: LOTE,
    });

    let ok = 0, semSecoes = 0, falha = 0, processados = 0;
    const inicio = Date.now();
    for (let i = 0; i < alvos.length; i++) {
      // Teto de tempo: para o loop com folga antes do maxDuration de 300s.
      // Os alvos que sobrarem continuam com tcuAnalise nulo e voltam a ser
      // selecionados no próximo run — é varredura, retoma sozinha.
      if (Date.now() - inicio > TIME_BUDGET_MS) {
        apiLogger.warn(
          { processados, restantes: alvos.length - processados },
          '[catalog-tcu] orçamento de tempo esgotado; parando lote (retoma no próximo run)'
        );
        break;
      }

      const alvo = alvos[i];
      // Uma queda de conexão (ou outro erro de infraestrutura) num item não
      // pode abortar o lote inteiro — captura, conta como falha e segue.
      try {
        const res = await catalogarAcordao(alvo);
        // Baldes mutuamente exclusivos: ok + semSecoes + falha = processados.
        if (res.status === 'ok') ok++;
        else if (res.status === 'ok-sem-secoes') semSecoes++;
        else falha++;
      } catch (err) {
        falha++;
        apiLogger.error({ err, documentId: alvo.id }, '[catalog-tcu] erro inesperado ao catalogar acórdão');
      }
      processados++;

      // Sem dormir depois do último item — não há próxima chamada ao TCU
      // que precise do intervalo educado.
      if (i < alvos.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    const restamNaFila = await prisma.document.count({
      where: {
        category: 'acordao',
        tcuAnalise: { equals: Prisma.DbNull }, // idem: Json null exige Prisma.DbNull
        tcuLinkPDF: { not: null },
        tcuAnaliseTentativas: { lt: MAX_TENTATIVAS },
      },
    });

    apiLogger.info(
      { processados, ok, semSecoes, falha, restamNaFila },
      '[catalog-tcu] lote concluído'
    );
    body = { processados, ok, semSecoes, falha, restamNaFila };

    // Retorna as stats pro withCronTelemetry: sem isso o ScraperHealthLog
    // sempre gravava 'success'/0/0/0, mesmo com o lote falhando inteiro —
    // o dashboard e os alertas (que leem essa tabela) nunca veriam a falha.
    return {
      itemsFound: alvos.length,
      itemsNew: ok + semSecoes,
      itemsError: falha,
      metadata: { processados, ok, semSecoes, falha, restamNaFila },
    };
  });

  return NextResponse.json(body);
}
