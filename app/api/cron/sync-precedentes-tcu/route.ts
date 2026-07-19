import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { persistirArestasDeAcordao, PRECEDENTES_VERSAO } from '@/lib/tcu/extrair-arestas-precedentes';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

/**
 * Cron: varre acórdãos já com inteiro teor cuja rede de precedentes ainda não
 * foi extraída (ou está numa versão antiga) e popula as arestas. Sem rede —
 * lê o tcuTextoCompleto guardado e roda a regex. Fecha o fluxo contínuo: o
 * backfill cobre o passivo, este cron cobre os acórdãos novos.
 *
 * Fila: category='acordao' + tcuTextoCompleto NOT NULL + (precedentesVersao IS
 * NULL OR < PRECEDENTES_VERSAO). Como cada item marca a versão ao terminar, a
 * fila drena e não há retentativa infinita.
 *
 * SEM cap de tentativas (ao contrário do catalog-tcu-inteiro-teor, que usa
 * tcuAnaliseTentativas < 3): omissão deliberada. Aqui o passo é só regex +
 * escrita no banco — não há a classe de falha permanente (RTF gigante,
 * não-RTF) que motivou o cap lá. Um doc que sempre falhasse seria re-selecionado
 * todo run, mas o try/catch por item não deixa isso travar o lote (os outros
 * 199 drenam), e o custo é 1 slot/dia — aceitável. Se surgir falha permanente
 * recorrente, aí sim vale um cap.
 */
export const maxDuration = 300;

const LOTE = 200; // sem rede: cada item é regex + poucas escritas; lote maior que o de catalogação
const TIME_BUDGET_MS = 250_000;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown> = {};

  await withCronTelemetry('sync-precedentes-tcu', async () => {
    const filaWhere = {
      category: 'acordao' as const,
      tcuTextoCompleto: { not: null },
      OR: [{ precedentesVersao: null }, { precedentesVersao: { lt: PRECEDENTES_VERSAO } }],
    };

    const alvos = await prisma.document.findMany({
      where: filaWhere,
      select: { id: true, acordaoNumero: true, acordaoAno: true, tcuTextoCompleto: true },
      orderBy: { id: 'asc' },
      take: LOTE,
    });

    let ok = 0, falha = 0, totalArestas = 0;
    const inicio = Date.now();
    for (const alvo of alvos) {
      if (Date.now() - inicio > TIME_BUDGET_MS) {
        apiLogger.warn({ ok, restantes: alvos.length - ok - falha }, '[sync-precedentes] orçamento de tempo esgotado; retoma no próximo run');
        break;
      }
      try {
        const n = await persistirArestasDeAcordao({
          origemId: alvo.id,
          numeroSelf: alvo.acordaoNumero,
          anoSelf: alvo.acordaoAno,
          texto: alvo.tcuTextoCompleto ?? '',
        });
        totalArestas += n;
        ok++;
      } catch (err) {
        falha++;
        apiLogger.error({ err, documentId: alvo.id }, '[sync-precedentes] erro ao extrair arestas');
      }
    }

    const restamNaFila = await prisma.document.count({ where: filaWhere });
    apiLogger.info({ ok, falha, totalArestas, restamNaFila }, '[sync-precedentes] lote concluído');
    body = { ok, falha, totalArestas, restamNaFila };
    return { itemsFound: alvos.length, itemsNew: ok, itemsError: falha, metadata: body };
  });

  return NextResponse.json(body);
}
