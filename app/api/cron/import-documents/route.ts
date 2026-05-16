import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAcordaosTCU, type AcordaoTCU } from '@/lib/tcu-scraper';
import { scrapeOrientacoesAGU, type OrientacaoNormativa } from '@/lib/agu-scraper';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';

/**
 * Cron Job: Importacao Automatica de Documentos
 *
 * Executa scrapers de forma automatica para importar novos documentos:
 * - TCU: Acordaos relacionados a licitacoes
 * - AGU: Orientacoes Normativas
 *
 * Seguranca: Requer Authorization: Bearer <CRON_SECRET>
 * Agendamento: Configurado no vercel.json (semanal)
 */
export async function GET(request: NextRequest) {
  // 1. Verificacao de seguranca - apenas cron jobs autorizados
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('import-documents', async () => {
      console.log('[Cron Import] Iniciando importacao automatica de documentos...');

    const results = {
      tcu: { success: false, count: 0, error: null as string | null },
      agu: { success: false, count: 0, error: null as string | null },
      startTime: new Date().toISOString(),
      endTime: '',
    };

    // 2. Scraper TCU - Busca acordaos dos ultimos 30 dias
    try {
      console.log('[Cron Import] Executando scraper TCU...');

      const currentYear = new Date().getFullYear();

      // Busca acordaos sobre licitacoes do ano atual
      const tcuAcordaos = await fetchAcordaosTCU({
        anoInicio: currentYear,
        anoFim: currentYear,
        quantidade: 50,
        searchTerm: 'licitacao',
        onlyRelevant: true,
      });

      // Filtra apenas documentos que ainda nao existem no banco
      const newAcordaos: AcordaoTCU[] = [];
      for (const acordao of tcuAcordaos) {
        const acordaoUrl = acordao.urlArquivoPDF || acordao.urlArquivo || acordao.urlAcordao || '';
        const acordaoTitle = `Acórdão TCU nº ${acordao.numeroAcordao}/${acordao.anoAcordao}`;
        const exists = await prisma.document.findFirst({
          where: {
            OR: [
              { url: acordaoUrl },
              { title: acordaoTitle },
            ],
          },
        });

        if (!exists) {
          newAcordaos.push(acordao);
        }
      }

      // Importa automaticamente documentos novos
      // Nota: Documentos ficam como "nao revisados" para admin aprovar depois
      for (const acordao of newAcordaos) {
        const importUrl = acordao.urlArquivoPDF || acordao.urlArquivo || acordao.urlAcordao || '';
        const importTitle = `Acórdão TCU nº ${acordao.numeroAcordao}/${acordao.anoAcordao}`;
        await prisma.document.create({
          data: {
            title: importTitle,
            description: acordao.sumario || '',
            url: importUrl,
            type: 'link',
            category: 'acordao',
            isPublic: false, // Privado ate admin revisar
            reviewed: false, // Marca como nao revisado
            courseId: '2', // Planejamento das Contratacoes (padrao)
            isCommon: true,
            tags: JSON.stringify([
              'TCU',
              'Acordao',
              acordao.colegiado || 'TCU',
              `Ano ${acordao.anoAcordao}`,
            ]),
            aiClassification: JSON.stringify({
              source: 'tcu-scraper',
              colegiado: acordao.colegiado,
              relator: acordao.relator,
              dataPublicacao: acordao.dataSessao,
            }),
          },
        });
      }

      results.tcu.success = true;
      results.tcu.count = newAcordaos.length;
      console.log(`[Cron Import] TCU: ${newAcordaos.length} novos documentos importados`);

    } catch (error) {
      console.error('[Cron Import] Erro no scraper TCU:', error);
      results.tcu.error = error instanceof Error ? error.message : 'Erro desconhecido';
    }

    // 3. Scraper AGU - Busca Orientacoes Normativas novas
    try {
      console.log('[Cron Import] Executando scraper AGU...');

      const aguOrientacoes = await scrapeOrientacoesAGU();

      // Filtra apenas ONs que ainda nao existem
      const newOns: OrientacaoNormativa[] = [];
      for (const on of aguOrientacoes) {
        const exists = await prisma.document.findFirst({
          where: {
            OR: [
              { url: on.linkFundamentacao },
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
            description: on.descricao || '',
            url: on.linkFundamentacao || '',
            type: 'pdf',
            category: 'orientacao-normativa',
            isPublic: false, // Privado ate admin revisar
            reviewed: false, // Marca como nao revisado
            courseId: '2', // Planejamento das Contratacoes (padrao)
            isCommon: true,
            tags: JSON.stringify([
              'AGU',
              'Orientacao Normativa',
              'AGU',
            ]),
            aiClassification: JSON.stringify({
              source: 'agu-scraper',
              orgao: 'AGU',
              data: on.ano,
              onNumber: on.onNumber,
              onYear: on.onYear,
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

      // 4. Log de execucao no console
      console.log('[Cron Import] Importacao concluida:', results);

      responseBody = {
        success: true,
        message: 'Importacao automatica executada com sucesso',
        results,
      };
      const totalErrors = (results.tcu.error ? 1 : 0) + (results.agu.error ? 1 : 0);
      return {
        itemsFound: results.tcu.count + results.agu.count,
        itemsNew: results.tcu.count + results.agu.count,
        itemsError: totalErrors,
        metadata: { tcu: results.tcu, agu: results.agu },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Erro ao executar importacao automatica',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
