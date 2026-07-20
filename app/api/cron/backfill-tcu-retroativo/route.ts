/**
 * Caminha o feed de dados abertos do TCU PARA TRÁS e insere os acórdãos
 * aproveitáveis como combustível do grafo de precedentes (spec 2026-07-20).
 *
 * Só isso: NÃO baixa RTF (é o catalog-tcu-inteiro-teor), NÃO enriquece com
 * LLM (seriam ~100 mil chamadas), NÃO embeda, NÃO escreve em TribunalDecision
 * (é a superfície /jurisprudencia).
 *
 * Idempotente: a constraint @@unique([acordaoNumero, acordaoAno,
 * tcuOrgaoJulgador]) faz o create duplicado estourar P2002, tratado como
 * ignorado. Repetir um offset não corrompe nada.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { montarDadosDocument, atingiuAlvo, DATA_ALVO, type ItemFeed } from '@/lib/tcu/backfill-retroativo';

export const maxDuration = 300;

const API = 'https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos';
const UA = 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)';
const CURSOR_ID = 'tcu-retroativo';
const PAGINA = 500;
const TIME_BUDGET_MS = 230_000; // uma pagina leva ~20s; folga sob o maxDuration de 300s

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let corpo: Record<string, unknown> = {};

  await withCronTelemetry('backfill-tcu-retroativo', async () => {
    const inicio = Date.now();
    const cursor =
      (await prisma.backfillCursor.findUnique({ where: { id: CURSOR_ID } })) ??
      (await prisma.backfillCursor.create({ data: { id: CURSOR_ID } }));

    if (cursor.concluido) {
      corpo = { concluido: true, totalInserido: cursor.totalInserido };
      return { itemsFound: 0, itemsNew: 0, itemsError: 0, metadata: { concluido: true } };
    }

    let offset = cursor.offset;
    let inseridos = 0, ignorados = 0, duplicados = 0, erros = 0, lidos = 0;
    let ultimoAcordao = cursor.ultimoAcordao, ultimaData = cursor.ultimaData;
    let concluido = false;

    while (Date.now() - inicio < TIME_BUDGET_MS && !concluido) {
      const res = await fetch(`${API}?inicio=${offset}&quantidade=${PAGINA}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        // Falha da fonte: NÃO avança o cursor, para não pular acórdãos.
        erros++;
        break;
      }
      const itens = (await res.json()) as ItemFeed[];
      if (!Array.isArray(itens) || itens.length === 0) {
        concluido = true;
        break;
      }
      lidos += itens.length;

      for (const item of itens) {
        if (atingiuAlvo(item, DATA_ALVO)) { concluido = true; break; }
        const dados = montarDadosDocument(item);
        if (!dados) { ignorados++; continue; }
        try {
          // Unchecked: passamos `courseId` como escalar, não como relação.
          await prisma.document.create({ data: dados as Prisma.DocumentUncheckedCreateInput });
          inseridos++;
          ultimoAcordao = `${dados.acordaoNumero}/${dados.acordaoAno}`;
          ultimaData = String(item.dataSessao ?? '');
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') duplicados++;
          else erros++;
        }
      }

      offset += itens.length;
      await prisma.backfillCursor.update({
        where: { id: CURSOR_ID },
        data: {
          offset,
          concluido,
          ultimoAcordao,
          ultimaData,
          totalInserido: { increment: inseridos },
          totalIgnorado: { increment: ignorados },
        },
      });
      inseridos = 0; ignorados = 0; // já contabilizados no cursor
      await new Promise((r) => setTimeout(r, 1000)); // rate limit 1 req/s
    }

    const final = await prisma.backfillCursor.findUnique({ where: { id: CURSOR_ID } });
    corpo = {
      offset: final?.offset, concluido: final?.concluido,
      totalInserido: final?.totalInserido, totalIgnorado: final?.totalIgnorado,
      ultimoAcordao: final?.ultimoAcordao, ultimaData: final?.ultimaData,
      lidosNesteRun: lidos, duplicados, erros,
    };
    return {
      itemsFound: lidos,
      itemsNew: final?.totalInserido ?? 0,
      itemsError: erros,
      metadata: { offset: final?.offset, duplicados, concluido: final?.concluido },
    };
  });

  return NextResponse.json(corpo);
}
