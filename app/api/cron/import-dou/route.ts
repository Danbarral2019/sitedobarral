/**
 * Cron Job: Importação Diária de Documentos do DOU para Staging
 *
 * Endpoint chamado diariamente pelo Vercel Cron para buscar, classificar
 * e salvar documentos relevantes do Diário Oficial da União no staging
 * para validação manual posterior.
 *
 * FLUXO:
 * 1. Busca API oficial DOU (últimos 7 dias)
 * 2. Classifica com DOUClassifier
 * 3. Salva em DOUStagingDocument:
 *    - Auto-aprovados: approvalStatus='auto_approved', imported=false
 *    - Pendentes: approvalStatus='pending', imported=false
 *    - Auto-rejeitados: approvalStatus='auto_rejected'
 * 4. Admin valida manualmente em /admin/dou-filtros
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
import { DOUClassifier } from '@/lib/dou-classifier';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutos (máximo para Vercel Pro)

/**
 * GET /api/cron/import-dou
 *
 * Busca e classifica documentos DOU, salvando no staging para validação manual
 */
export async function GET(request: NextRequest) {
  console.log('[Cron DOU Staging] 🚀 Iniciando importação para staging...');

  try {
    // Validar secret do cron (segurança)
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.error('[Cron DOU Staging] ❌ Secret inválido');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      );
    }

    // Parâmetros da query string com validação
    const { searchParams } = new URL(request.url);

    // Validar período (allow-list)
    const ALLOWED_PERIODS = ['week', 'month'] as const;
    const periodParam = searchParams.get('period') || 'week';

    if (!ALLOWED_PERIODS.includes(periodParam as typeof ALLOWED_PERIODS[number])) {
      console.error(`[Cron DOU Staging] ❌ Período inválido: ${periodParam}`);
      return NextResponse.json(
        { error: `Período inválido. Valores permitidos: ${ALLOWED_PERIODS.join(', ')}` },
        { status: 400 }
      );
    }
    const period = periodParam as typeof ALLOWED_PERIODS[number];

    // Validar e limitar maxResults (proteção contra DoS)
    const MAX_ALLOWED_RESULTS = 500;
    const limitParam = searchParams.get('limit') || '50';
    let maxResults = parseInt(limitParam, 10);

    if (isNaN(maxResults) || maxResults <= 0) {
      console.warn(`[Cron DOU Staging] ⚠️ Limite inválido '${limitParam}', usando padrão 50`);
      maxResults = 50;
    }

    maxResults = Math.min(maxResults, MAX_ALLOWED_RESULTS);
    if (maxResults === MAX_ALLOWED_RESULTS) {
      console.warn(`[Cron DOU Staging] ⚠️ Limite cappado em ${MAX_ALLOWED_RESULTS} (proteção DoS)`);
    }

    console.log(`[Cron DOU Staging] Buscando publicações (período: ${period}, limite: ${maxResults})`);

    // PASSO 1: Buscar publicações na API oficial do DOU
    const searchTerm = 'licitação OR pregão OR dispensa OR contrato OR contratação';

    const results = period === 'month'
      ? await searchLastMonth(searchTerm, undefined, maxResults)
      : await searchLastWeek(searchTerm, undefined, maxResults);

    console.log(`[Cron DOU Staging] ✅ ${results.length} publicações encontradas`);

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma publicação encontrada',
        stats: {
          buscados: 0,
          autoAprovados: 0,
          pendentes: 0,
          autoRejeitados: 0,
          duplicados: 0,
          erros: 0,
        }
      });
    }

    // PASSO 2: Classificar documentos com DOUClassifier
    console.log('[Cron DOU Staging] 🤖 Classificando documentos...');
    const classifications = DOUClassifier.classifyBatch(results);

    let autoAprovados = 0;
    let pendentes = 0;
    let autoRejeitados = 0;
    let duplicados = 0;
    let erros = 0;

    // PASSO 3: Salvar no staging (DOUStagingDocument)
    console.log('[Cron DOU Staging] 💾 Salvando no staging...');

    for (const [result, classification] of classifications.entries()) {
      try {
        // Remove HTML do título
        const cleanTitle = result.title.replace(/<[^>]*>/g, '').trim();

        // Verificar duplicatas (por URL)
        const existingDoc = await prisma.dOUStagingDocument.findFirst({
          where: { url: result.href }
        });

        if (existingDoc) {
          duplicados++;
          console.log(`[Cron DOU Staging] ⏭️  Duplicado: ${cleanTitle.substring(0, 60)}...`);
          continue;
        }

        // Formatar data DD/MM/YYYY (DOU API retorna nesse formato)
        const publishDate = result.date || new Date().toLocaleDateString('pt-BR');

        // Criar documento no staging
        await prisma.dOUStagingDocument.create({
          data: {
            douId: result.href, // Usa URL como ID único temporário
            title: cleanTitle,
            abstract: result.abstract || '',
            url: result.href,
            section: result.section || 'do3',
            publishDate: publishDate,
            hierarchyStr: result.hierarchyStr,

            // Classificação automática
            category: classification.category,
            approvalStatus: classification.status,
            confidence: classification.confidence,
            reasoning: JSON.stringify(classification.reasoning),
            isRelevant: classification.isRelevant,
            requiresReview: classification.requiresReview,

            // Controle
            imported: false, // Aguardando validação manual
          }
        });

        // Contar por status
        if (classification.status === 'auto_approved') {
          autoAprovados++;
          console.log(`[Cron DOU Staging] ✅ Auto-aprovado (${classification.confidence}%): ${cleanTitle.substring(0, 60)}...`);
        } else if (classification.status === 'pending') {
          pendentes++;
          console.log(`[Cron DOU Staging] ⏳ Pendente (${classification.confidence}%): ${cleanTitle.substring(0, 60)}...`);
        } else if (classification.status === 'auto_rejected') {
          autoRejeitados++;
          console.log(`[Cron DOU Staging] ❌ Auto-rejeitado: ${cleanTitle.substring(0, 60)}...`);
        }

      } catch (error) {
        erros++;
        console.error(`[Cron DOU Staging] ❌ Erro ao salvar documento:`, error);
      }
    }

    console.log('[Cron DOU Staging] ✅ Importação para staging concluída!');
    console.log(`[Cron DOU Staging] Auto-aprovados: ${autoAprovados}, Pendentes: ${pendentes}, Auto-rejeitados: ${autoRejeitados}`);

    // Retornar estatísticas
    return NextResponse.json({
      success: true,
      message: `Staging populado: ${autoAprovados} auto-aprovados, ${pendentes} pendentes`,
      stats: {
        buscados: results.length,
        autoAprovados,
        pendentes,
        autoRejeitados,
        duplicados,
        erros,
      },
    });

  } catch (error) {
    console.error('[Cron DOU Staging] ❌ Erro fatal:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
