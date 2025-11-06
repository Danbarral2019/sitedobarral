/**
 * Cron Job: Importação Diária de Documentos do DOU
 *
 * Endpoint chamado diariamente pelo Vercel Cron para buscar
 * e importar documentos relevantes do Diário Oficial da União (DOU federal).
 *
 * Usa a API oficial da Imprensa Nacional (http://www.in.gov.br/consulta/-/buscar/dou)
 * para buscar publicações federais relevantes.
 *
 * Configuração no vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/import-dou",
 *     "schedule": "0 10 * * *"  // 10h UTC = 7h BR (todo dia)
 *   }]
 * }
 *
 * Segurança: Requer header x-cron-secret com CRON_SECRET do .env
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchLastWeek, searchLastMonth } from '@/lib/dou-api';
import { importDOUResultsOfficial, analyzeRelevanceDOU } from '@/lib/dou-module';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutos (máximo para Vercel Pro)

/**
 * POST /api/cron/import-dou
 *
 * Importa documentos do DOU dos últimos N dias (padrão: 7 dias)
 */
export async function GET(request: NextRequest) {
  console.log('[Cron DOU] 🚀 Iniciando importação diária do DOU...');
  console.log('[Cron DOU] DEBUG - URL:', request.url);
  console.log('[Cron DOU] DEBUG - Runtime:', runtime);
  console.log('[Cron DOU] DEBUG - MaxDuration:', maxDuration);

  try {
    console.log('[Cron DOU] DEBUG - Etapa 1/7: Validando secret...');
    // Validar secret do cron (segurança)
    const cronSecret = request.headers.get('x-cron-secret');
    console.log('[Cron DOU] DEBUG - Secret presente:', !!cronSecret);
    console.log('[Cron DOU] DEBUG - CRON_SECRET env presente:', !!process.env.CRON_SECRET);

    if (cronSecret !== process.env.CRON_SECRET) {
      console.error('[Cron DOU] ❌ Secret inválido');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      );
    }
    console.log('[Cron DOU] DEBUG - ✓ Secret validado');

    console.log('[Cron DOU] DEBUG - Etapa 2/7: Parsing params...');
    // Parâmetros da query string com validação
    const { searchParams } = new URL(request.url);

    // Validar período (allow-list)
    const ALLOWED_PERIODS = ['week', 'month'] as const;
    const periodParam = searchParams.get('period') || 'week';

    if (!ALLOWED_PERIODS.includes(periodParam as typeof ALLOWED_PERIODS[number])) {
      console.error(`[Cron DOU] ❌ Período inválido: ${periodParam}`);
      return NextResponse.json(
        { error: `Período inválido. Valores permitidos: ${ALLOWED_PERIODS.join(', ')}` },
        { status: 400 }
      );
    }
    const period = periodParam as typeof ALLOWED_PERIODS[number];

    // Validar e limitar maxResults (proteção contra DoS)
    const MAX_ALLOWED_RESULTS = 500;
    const limitParam = searchParams.get('limit') || '20';
    let maxResults = parseInt(limitParam, 10);

    if (isNaN(maxResults) || maxResults <= 0) {
      console.warn(`[Cron DOU] ⚠️ Limite inválido '${limitParam}', usando padrão 20`);
      maxResults = 20;
    }

    maxResults = Math.min(maxResults, MAX_ALLOWED_RESULTS);
    if (maxResults === MAX_ALLOWED_RESULTS) {
      console.warn(`[Cron DOU] ⚠️ Limite cappado em ${MAX_ALLOWED_RESULTS} (proteção DoS)`);
    }

    console.log(`[Cron DOU] DEBUG - ✓ Params validados (período: ${period}, limite: ${maxResults})`);
    console.log(`[Cron DOU] Buscando publicações (período: ${period}, limite: ${maxResults})`);

    console.log('[Cron DOU] DEBUG - Etapa 3/7: Buscando na API do DOU...');
    // PASSO 1: Buscar publicações na API oficial do DOU
    const searchTerm = 'licitação OR pregão OR dispensa OR contrato OR contratação';

    let results;
    try {
      results = period === 'month'
        ? await searchLastMonth(searchTerm, undefined, maxResults)
        : await searchLastWeek(searchTerm, undefined, maxResults);
      console.log(`[Cron DOU] DEBUG - ✓ API call OK: ${results.length} publicações`);
    } catch (apiError) {
      console.error('[Cron DOU] DEBUG - ❌ Erro na API do DOU:', apiError);
      throw new Error(`Falha ao buscar DOU: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
    }

    console.log(`[Cron DOU] ✅ ${results.length} publicações encontradas`);

    if (results.length === 0) {
      console.log('[Cron DOU] DEBUG - Nenhuma publicação encontrada, retornando sucesso vazio');
      return NextResponse.json({
        success: true,
        message: 'Nenhuma publicação encontrada',
        stats: {
          buscados: 0,
          relevantes: 0,
          novos: 0,
          atualizados: 0,
          semMudancas: 0,
          erros: 0,
        }
      });
    }

    console.log('[Cron DOU] DEBUG - Etapa 4/7: Filtrando por relevância...');
    // PASSO 2: Filtrar por relevância (pré-filtro para economizar processamento)
    let relevantResults;
    try {
      relevantResults = results.filter(result => {
        // Remove HTML do título
        const title = result.title.replace(/<[^>]*>/g, '').trim();

        const { isRelevant } = analyzeRelevanceDOU(
          title,
          result.abstract || ''
        );

        return isRelevant;
      });
      console.log(`[Cron DOU] DEBUG - ✓ Filtro OK: ${relevantResults.length} relevantes`);
    } catch (filterError) {
      console.error('[Cron DOU] DEBUG - ❌ Erro ao filtrar relevância:', filterError);
      throw new Error(`Falha ao filtrar: ${filterError instanceof Error ? filterError.message : String(filterError)}`);
    }

    console.log(`[Cron DOU] 📊 ${relevantResults.length} publicações relevantes (${Math.round((relevantResults.length / results.length) * 100)}%)`);

    if (relevantResults.length === 0) {
      console.log('[Cron DOU] DEBUG - Nenhuma publicação relevante, retornando sucesso vazio');
      return NextResponse.json({
        success: true,
        message: 'Nenhuma publicação relevante encontrada',
        stats: {
          buscados: results.length,
          relevantes: 0,
          novos: 0,
          atualizados: 0,
          semMudancas: 0,
          erros: 0,
        }
      });
    }

    console.log('[Cron DOU] DEBUG - Etapa 5/7: Importando com versionamento...');
    // PASSO 3: Importar com versionamento
    let importResult;
    try {
      importResult = await importDOUResultsOfficial(relevantResults);
      console.log('[Cron DOU] DEBUG - ✓ Import OK:', importResult);
    } catch (importError) {
      console.error('[Cron DOU] DEBUG - ❌ Erro ao importar:', importError);
      throw new Error(`Falha ao importar: ${importError instanceof Error ? importError.message : String(importError)}`);
    }

    console.log('[Cron DOU] ✅ Importação concluída!');
    console.log(`[Cron DOU] Novos: ${importResult.novos}, Atualizados: ${importResult.atualizados}, Sem mudanças: ${importResult.semMudancas}, Erros: ${importResult.erros}`);

    console.log('[Cron DOU] DEBUG - Etapa 6/7: Montando resposta...');
    // Retornar estatísticas
    const response = {
      success: true,
      message: `Importação concluída: ${importResult.novos} novos, ${importResult.atualizados} atualizados`,
      stats: {
        buscados: results.length,
        relevantes: relevantResults.length,
        novos: importResult.novos,
        atualizados: importResult.atualizados,
        semMudancas: importResult.semMudancas,
        erros: importResult.erros,
      },
      details: importResult.detalhes.slice(0, 10), // Primeiros 10 para não sobrecarregar resposta
    };

    console.log('[Cron DOU] DEBUG - Etapa 7/7: Retornando resposta...');
    return NextResponse.json(response);

  } catch (error) {
    console.error('[Cron DOU] ❌ Erro fatal:', error);
    console.error('[Cron DOU] DEBUG - Tipo do erro:', typeof error);
    console.error('[Cron DOU] DEBUG - Error name:', error instanceof Error ? error.name : 'N/A');
    console.error('[Cron DOU] DEBUG - Error message:', error instanceof Error ? error.message : String(error));
    console.error('[Cron DOU] DEBUG - Error stack:', error instanceof Error ? error.stack : 'N/A');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        errorType: error instanceof Error ? error.name : typeof error,
        errorStack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined,
      },
      { status: 500 }
    );
  }
}
