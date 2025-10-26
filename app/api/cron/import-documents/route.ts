import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchTCUDocuments } from '@/lib/tcu-scraper';
import { scrapeAGUOrientacoesNormativas } from '@/lib/agu-scraper';

/**
 * Cron Job: Importação Automática de Documentos
 *
 * Executa scrapers de forma automática para importar novos documentos:
 * - TCU: Acórdãos relacionados a licitações
 * - AGU: Orientações Normativas
 *
 * Segurança: Requer CRON_SECRET no header
 * Agendamento: Configurado no vercel.json (semanal)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificação de segurança - apenas cron jobs autorizados
    const cronSecret = request.headers.get('x-cron-secret');

    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    console.log('[Cron Import] Iniciando importação automática de documentos...');

    const results = {
      tcu: { success: false, count: 0, error: null as string | null },
      agu: { success: false, count: 0, error: null as string | null },
      startTime: new Date().toISOString(),
      endTime: '',
    };

    // 2. Scraper TCU - Busca acórdãos dos últimos 30 dias
    try {
      console.log('[Cron Import] Executando scraper TCU...');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Busca acórdãos sobre licitações dos últimos 30 dias
      const tcuResults = await searchTCUDocuments({
        keywords: 'licitação',
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        documentTypes: ['acordao'],
      });

      // Filtra apenas documentos que ainda não existem no banco
      const newDocuments = [];
      for (const doc of tcuResults.documents) {
        const exists = await prisma.document.findFirst({
          where: {
            OR: [
              { url: doc.url },
              { title: doc.title },
            ],
          },
        });

        if (!exists) {
          newDocuments.push(doc);
        }
      }

      // Importa automaticamente documentos novos
      // Nota: Documentos ficam como "não revisados" para admin aprovar depois
      for (const doc of newDocuments) {
        await prisma.document.create({
          data: {
            title: doc.title,
            description: doc.summary || '',
            url: doc.url,
            type: 'link',
            category: 'acordao',
            isPublic: false, // Privado até admin revisar
            reviewed: false, // Marca como não revisado
            courseId: '1', // Nova Lei de Licitações (padrão)
            isCommon: false,
            tags: JSON.stringify(doc.tags || []),
            aiClassification: doc.metadata ? JSON.stringify({
              source: 'tcu-scraper',
              metadata: doc.metadata,
            }) : null,
          },
        });
      }

      results.tcu.success = true;
      results.tcu.count = newDocuments.length;
      console.log(`[Cron Import] TCU: ${newDocuments.length} novos documentos importados`);

    } catch (error) {
      console.error('[Cron Import] Erro no scraper TCU:', error);
      results.tcu.error = error instanceof Error ? error.message : 'Erro desconhecido';
    }

    // 3. Scraper AGU - Busca Orientações Normativas novas
    try {
      console.log('[Cron Import] Executando scraper AGU...');

      const aguResults = await scrapeAGUOrientacoesNormativas();

      // Filtra apenas ONs que ainda não existem
      const newOns = [];
      for (const on of aguResults.documents) {
        const exists = await prisma.document.findFirst({
          where: {
            OR: [
              { url: on.pdfUrl },
              { title: on.numero },
            ],
          },
        });

        if (!exists) {
          newOns.push(on);
        }
      }

      // Importa automaticamente ONs novas
      for (const on of newOns) {
        await prisma.document.create({
          data: {
            title: on.numero,
            description: on.ementa || '',
            url: on.pdfUrl,
            type: 'pdf',
            category: 'orientacao-normativa',
            isPublic: false, // Privado até admin revisar
            reviewed: false, // Marca como não revisado
            courseId: '1', // Nova Lei de Licitações (padrão)
            isCommon: false,
            tags: JSON.stringify([
              'AGU',
              'Orientação Normativa',
              on.orgao || 'AGU',
            ]),
            aiClassification: JSON.stringify({
              source: 'agu-scraper',
              orgao: on.orgao,
              data: on.data,
            }),
          },
        });
      }

      results.agu.success = true;
      results.agu.count = newOns.length;
      console.log(`[Cron Import] AGU: ${newOns.length} novas ONs importadas`);

    } catch (error) {
      console.error('[Cron Import] Erro no scraper AGU:', error);
      results.agu.error = error instanceof Error ? error.message : 'Erro desconhecido';
    }

    results.endTime = new Date().toISOString();

    // 4. Log de execução no console
    console.log('[Cron Import] Importação concluída:', results);

    // 5. Retorna resumo
    return NextResponse.json({
      success: true,
      message: 'Importação automática executada com sucesso',
      results,
    });

  } catch (error) {
    console.error('[Cron Import] Erro fatal:', error);
    return NextResponse.json(
      {
        error: 'Erro ao executar importação automática',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
