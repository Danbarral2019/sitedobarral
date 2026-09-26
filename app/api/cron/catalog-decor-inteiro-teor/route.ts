import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  capturarInteiroTeorDecor,
  contarFilaDecor,
  selecionarFilaDecor,
} from '@/lib/agu/inteiro-teor-decor';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

/**
 * Cron: captura contínua do INTEIRO TEOR dos pareceres da AGU publicados em
 * PDF público do DECOR (`https://cgu.agu.gov.br/decor/arquivos/*.pdf`).
 *
 * Fecha o fluxo que o sync-conuni deixa aberto: ele cria/atualiza o documento
 * com a URL do PDF, mas só grava em `content` a ementa e os metadados. Este
 * cron varre a fila e grava o texto em `textoIntegral` (NUNCA em `content`,
 * que o sync mensal sobrescreve). Cobre as inclusões futuras: documento novo
 * do sync entra na fila sozinho. O passivo corre pelo
 * scripts/backfill-decor-inteiro-teor.ts, com o mesmo núcleo.
 *
 * Fila: url DECOR .pdf + textoIntegral IS NULL + textoIntegralTentativas < 3.
 * Ao corrigir a extração, resetar o contador dos afetados os traz de volta:
 *   UPDATE "Document" SET "textoIntegralTentativas" = 0
 *   WHERE "textoIntegral" IS NULL AND "url" ILIKE 'https://cgu.agu.gov.br/decor/arquivos/%.pdf';
 *
 * Os links do Sapiens (`sapiens.agu.gov.br/valida_publico`) exigem login e
 * ficam fora. O texto é para LEITURA: não entra no embedding.
 *
 * Todo o trabalho acontece ANTES da resposta — nada fica pendurado depois do
 * return (promise solta em serverless é descartada).
 */

// ~1 s por PDF (medido) + 1,5 s de pausa: um lote de 20 leva ~50 s. O teto de
// tempo interrompe com folga se o servidor da AGU ficar lento (timeout de 60 s
// por download); o resto do lote volta no próximo run.
export const maxDuration = 300;

const LOTE = 20;
const DELAY_MS = 1500; // educado com o servidor da AGU (sem rate limit documentado)
const TIME_BUDGET_MS = 230_000; // teto de segurança abaixo do maxDuration de 300 s

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown> = {};

  await withCronTelemetry('catalog-decor-inteiro-teor', async () => {
    const alvos = await selecionarFilaDecor(prisma, { take: LOTE });

    let ok = 0, falha = 0, truncados = 0, processados = 0;
    const inicio = Date.now();
    for (let i = 0; i < alvos.length; i++) {
      if (Date.now() - inicio > TIME_BUDGET_MS) {
        apiLogger.warn(
          { processados, restantes: alvos.length - processados },
          '[catalog-decor] orçamento de tempo esgotado; parando lote (retoma no próximo run)'
        );
        break;
      }

      const alvo = alvos[i];
      // Erro de infraestrutura num item (ex.: conexão com o banco) não aborta
      // o lote: conta como falha e segue. A tentativa não foi gasta, então o
      // item volta à fila no próximo run.
      try {
        const res = await capturarInteiroTeorDecor(prisma, alvo);
        if (res.status === 'ok') {
          ok++;
          if (res.truncado) truncados++;
        } else {
          falha++;
          apiLogger.warn(
            { documentId: alvo.id, url: alvo.url, erro: res.erro },
            '[catalog-decor] falha ao capturar inteiro teor'
          );
        }
      } catch (err) {
        falha++;
        apiLogger.error({ err, documentId: alvo.id }, '[catalog-decor] erro inesperado ao capturar inteiro teor');
      }
      processados++;

      if (i < alvos.length - 1) await sleep(DELAY_MS);
    }

    const restamNaFila = await contarFilaDecor(prisma);

    apiLogger.info({ processados, ok, falha, truncados, restamNaFila }, '[catalog-decor] lote concluído');
    body = { processados, ok, falha, truncados, restamNaFila };

    return {
      itemsFound: alvos.length,
      itemsNew: ok,
      itemsError: falha,
      metadata: { processados, ok, falha, truncados, restamNaFila },
    };
  });

  return NextResponse.json(body);
}
