/**
 * Cron Job: Importação Diária de Documentos do DOU
 *
 * Endpoint chamado diariamente pelo Vercel Cron para buscar
 * e importar documentos relevantes do Diário Oficial da União.
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
import { searchLastDays } from '@/lib/querido-diario';
import { importDOUDocuments, analyzeRelevanceDOU } from '@/lib/dou-module';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutos (máximo para Vercel Pro)

/**
 * POST /api/cron/import-dou
 *
 * Importa documentos do DOU dos últimos N dias (padrão: 7 dias)
 */
export async function GET(request: NextRequest) {
  console.log('[Cron DOU] 🚀 Iniciando importação diária do DOU...');

  try {
    // Validar secret do cron (segurança)
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.error('[Cron DOU] ❌ Secret inválido');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      );
    }

    // Parâmetros da query string
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7'); // Padrão: últimos 7 dias
    const limit = parseInt(searchParams.get('limit') || '50'); // Padrão: 50 documentos

    console.log(`[Cron DOU] Buscando publicações dos últimos ${days} dias (limite: ${limit})`);

    // PASSO 1: Buscar publicações no Querido Diário
    const gazettes = await searchLastDays(days, limit);

    console.log(`[Cron DOU] ✅ ${gazettes.length} publicações encontradas`);

    if (gazettes.length === 0) {
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

    // PASSO 2: Filtrar por relevância (pré-filtro para economizar processamento)
    const relevantGazettes = gazettes.filter(gazette => {
      // Verificar se tem excerpts
      if (!gazette.excerpts || gazette.excerpts.length === 0) {
        return false;
      }

      // Analisar relevância do primeiro excerpt
      const firstExcerpt = gazette.excerpts[0];
      const { isRelevant } = analyzeRelevanceDOU(
        firstExcerpt.highlight || '',
        firstExcerpt.excerpt || ''
      );

      return isRelevant;
    });

    console.log(`[Cron DOU] 📊 ${relevantGazettes.length} publicações relevantes (${Math.round((relevantGazettes.length / gazettes.length) * 100)}%)`);

    if (relevantGazettes.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma publicação relevante encontrada',
        stats: {
          buscados: gazettes.length,
          relevantes: 0,
          novos: 0,
          atualizados: 0,
          semMudancas: 0,
          erros: 0,
        }
      });
    }

    // PASSO 3: Importar com versionamento
    const importResult = await importDOUDocuments(relevantGazettes);

    console.log('[Cron DOU] ✅ Importação concluída!');
    console.log(`[Cron DOU] Novos: ${importResult.novos}, Atualizados: ${importResult.atualizados}, Sem mudanças: ${importResult.semMudancas}, Erros: ${importResult.erros}`);

    // Retornar estatísticas
    return NextResponse.json({
      success: true,
      message: `Importação concluída: ${importResult.novos} novos, ${importResult.atualizados} atualizados`,
      stats: {
        buscados: gazettes.length,
        relevantes: relevantGazettes.length,
        novos: importResult.novos,
        atualizados: importResult.atualizados,
        semMudancas: importResult.semMudancas,
        erros: importResult.erros,
      },
      details: importResult.detalhes.slice(0, 10), // Primeiros 10 para não sobrecarregar resposta
    });

  } catch (error) {
    console.error('[Cron DOU] ❌ Erro fatal:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
