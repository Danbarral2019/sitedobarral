/**
 * Telemetria padrão para crons.
 *
 * Resolve o padrão de falha silenciosa que mascarou o bug do LeiIndexer
 * por meses (truncamento de JSON Gemini, descoberto em 2026-05-16):
 * - Sempre persiste ScraperHealthLog (entrada + saída), permitindo
 *   detectar crons que pararam ou estão degradados
 * - Sempre captura exceções no Sentry com tag `cron:<nome>`, então
 *   alertas chegam imediatamente em vez de ficarem só em console.log
 *   da Vercel (que vence em ~24h)
 * - Loga estruturado via apiLogger (Pino) com contexto
 *
 * Uso:
 *
 * ```ts
 * export const GET = withCronTelemetry('sync-tcu-acordaos', async () => {
 *   const result = await syncTcuAcordaos();
 *   return {
 *     itemsFound: result.total,
 *     itemsNew: result.created,
 *     itemsError: result.errors,
 *     metadata: { batchSize: 500 },
 *   };
 * });
 * ```
 *
 * O wrapper:
 * - Mede duração automaticamente
 * - Em sucesso: status 'success' (ou 'partial_failure' se itemsError > 0)
 * - Em erro: status 'failure', persiste mensagem, Sentry.captureException, re-lança
 * - SEMPRE persiste ScraperHealthLog (idempotente — health log próprio
 *   nunca pode bloquear o cron)
 *
 * Para integrar com NextRequest/Response, ver `withCronRoute` abaixo.
 */

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { apiLogger } from './logger';

export interface CronStats {
  /** Total de itens descobertos/processados na execução. */
  itemsFound?: number;
  /** Itens efetivamente criados/atualizados (sucesso). */
  itemsNew?: number;
  /** Itens com erro durante o processamento (não fatal). */
  itemsError?: number;
  /** Metadata adicional serializada como JSON na coluna `metadata`. */
  metadata?: Record<string, unknown>;
}

export type CronHandler = () => Promise<CronStats | void>;

/**
 * Persiste registro em `ScraperHealthLog`. Falhas no log não bloqueiam
 * o cron (mesma estratégia de `lib/tribunal-scrapers/utils.ts:logScraperHealth`).
 */
async function persistHealthLog(
  scraperCode: string,
  status: 'success' | 'partial_failure' | 'failure',
  stats: CronStats & { duration: number; errorMessage?: string },
): Promise<void> {
  try {
    await prisma.scraperHealthLog.create({
      data: {
        scraperCode,
        status,
        itemsFound: stats.itemsFound ?? 0,
        itemsNew: stats.itemsNew ?? 0,
        itemsError: stats.itemsError ?? 0,
        duration: stats.duration,
        errorMessage: stats.errorMessage?.slice(0, 2000) ?? null,
        metadata: stats.metadata ? JSON.stringify(stats.metadata) : null,
      },
    });
  } catch (logError) {
    apiLogger.error(
      { cron: scraperCode, err: logError instanceof Error ? logError.message : String(logError) },
      'Falha ao persistir ScraperHealthLog (não bloqueia o cron)',
    );
  }
}

/**
 * Envolve uma função de cron com:
 * - Medição de duração
 * - Persistência de `ScraperHealthLog`
 * - Captura de exceções no Sentry com tag `cron:<scraperCode>`
 * - Logging estruturado via Pino
 *
 * O handler retorna `CronStats` com os números do batch. Se voltar `void`,
 * conta como execução vazia bem-sucedida (útil para crons que nem sempre
 * têm trabalho a fazer).
 *
 * Em caso de erro: persiste status `failure`, captura Sentry, e RE-LANÇA
 * o erro original para o caller decidir o status HTTP (geralmente 500
 * via withCronRoute ou handleApiError).
 */
export async function withCronTelemetry<T extends CronStats | void>(
  scraperCode: string,
  handler: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  apiLogger.info({ cron: scraperCode }, 'Cron iniciado');

  try {
    const result = await handler();
    const stats: CronStats = result ?? {};
    const duration = Date.now() - startedAt;
    const status: 'success' | 'partial_failure' =
      (stats.itemsError ?? 0) > 0 ? 'partial_failure' : 'success';

    await persistHealthLog(scraperCode, status, { ...stats, duration });

    apiLogger.info(
      {
        cron: scraperCode,
        status,
        duration,
        itemsFound: stats.itemsFound ?? 0,
        itemsNew: stats.itemsNew ?? 0,
        itemsError: stats.itemsError ?? 0,
      },
      'Cron concluído',
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);

    Sentry.captureException(error, {
      tags: { cron: scraperCode },
      contexts: {
        cron: { scraperCode, durationMs: duration },
      },
    });

    await persistHealthLog(scraperCode, 'failure', {
      duration,
      errorMessage,
    });

    apiLogger.error(
      {
        cron: scraperCode,
        duration,
        err: errorMessage,
      },
      'Cron falhou',
    );

    throw error;
  }
}

/**
 * Atalho para handlers de rota Next.js. Combina:
 * - Verificação do header `Authorization: Bearer ${CRON_SECRET}` se a env
 *   var existir (pula em dev local)
 * - `withCronTelemetry` em torno do handler
 *
 * Uso:
 *
 * ```ts
 * export const GET = withCronRoute('sync-tcu-acordaos', async (req) => {
 *   const stats = await syncTcuAcordaos();
 *   return stats; // retorna CronStats, vira NextResponse.json({ success: true, ...stats })
 * });
 * ```
 *
 * Cron que precisa retornar resposta customizada: usar `withCronTelemetry`
 * diretamente em vez deste atalho.
 */
export function withCronRoute(
  scraperCode: string,
  handler: (req: NextRequest) => Promise<CronStats | void>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    // Auth: bearer token cron secret (skipa se var não setada — dev local)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    try {
      const stats = await withCronTelemetry(scraperCode, () => handler(req));
      return NextResponse.json({ success: true, ...(stats ?? {}) });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Erro interno',
        },
        { status: 500 },
      );
    }
  };
}
