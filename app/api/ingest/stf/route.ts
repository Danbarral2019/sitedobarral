import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCronAuth } from '@/lib/cron-auth';
import { apiLogger } from '@/lib/logger';
import { normalizarDocumentoStf } from '@/lib/stf/normalizar';
import { selecionarRecorte } from '@/lib/stf/recorte';
import { persistirDecisoesStf } from '@/lib/stf/persistir';
import { logScraperHealth } from '@/lib/tribunal-scrapers/utils';
import type { StfDocumentoBruto, StfDecisaoNormalizada } from '@/lib/stf/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Código de saúde do fluxo do STF. Distinto dos scrapers do registry porque a
 * coleta acontece FORA da Vercel — num job do GitHub Actions com navegador
 * real, única via que vence o desafio JavaScript do AWS WAF do portal. O cron
 * `tribunal-scraper-health` lê este log como lê o dos demais.
 */
export const SCRAPER_CODE_STF = 'stf-runner';

/**
 * POST /api/ingest/stf
 * Recebe do runner o lote bruto do índice do STF, aplica normalização e
 * recorte e persiste. Autenticado por CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const inicio = Date.now();

  try {
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    const body = (await request.json().catch(() => null)) as
      | { documentos?: StfDocumentoBruto[] }
      | null;

    if (!body || !Array.isArray(body.documentos)) {
      return NextResponse.json(
        { error: 'corpo inválido: esperado { documentos: [] }' },
        { status: 400 }
      );
    }

    const recebidos = body.documentos.length;

    // Lote vazio NUNCA é sucesso. Ausência de resposta é ambígua: pode ser
    // "nada novo" ou o WAF tendo barrado o runner silenciosamente. Falha
    // visível é preferível a falha terminal muda.
    if (recebidos === 0) {
      await logScraperHealth(SCRAPER_CODE_STF, 'failure', {
        duration: Date.now() - inicio,
        errorMessage: 'lote vazio — coleta no STF não produziu documentos',
      });
      return NextResponse.json(
        { error: 'lote vazio', recebidos: 0 },
        { status: 422 }
      );
    }

    const normalizados = body.documentos
      .map(normalizarDocumentoStf)
      .filter((d): d is StfDecisaoNormalizada => d !== null);
    const selecionados = selecionarRecorte(normalizados);

    const r = await persistirDecisoesStf(selecionados, {});
    const duration = Date.now() - inicio;

    await logScraperHealth(
      SCRAPER_CODE_STF,
      r.erros > 0 ? 'partial_failure' : 'success',
      {
        itemsFound: recebidos,
        itemsNew: r.criados,
        itemsError: r.erros,
        duration,
        errorMessage: r.mensagensErro[0],
        metadata: { selecionados: selecionados.length, atualizados: r.atualizados },
      }
    );

    apiLogger.info(
      { recebidos, selecionados: selecionados.length, ...r },
      '[Ingest STF] lote processado'
    );

    return NextResponse.json({
      success: true,
      recebidos,
      selecionados: selecionados.length,
      criados: r.criados,
      atualizados: r.atualizados,
      ignorados: r.ignorados,
      erros: r.erros,
    });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    Sentry.captureException(error, { tags: { ingest: 'stf' } });
    apiLogger.error({ err: error }, '[Ingest STF] erro fatal');

    await logScraperHealth(SCRAPER_CODE_STF, 'failure', {
      duration: Date.now() - inicio,
      errorMessage: mensagem,
    });

    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
