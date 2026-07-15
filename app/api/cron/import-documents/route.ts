import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAcordaosTCU, type AcordaoTCU } from '@/lib/tcu-scraper';
import { scrapeAGU } from '@/lib/agu-scraper-v4';
import { importOrientacoesNormativasWithVersioning } from '@/lib/agu-modules/orientacoes-normativas';
import type { AGUDocument } from '@/lib/agu-types';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

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
      apiLogger.error({ err: error }, '[Cron Import] Erro no scraper TCU:');
      results.tcu.error = error instanceof Error ? error.message : 'Erro desconhecido';
    }

    // 3. Scraper AGU - Busca Orientacoes Normativas novas
    try {
      console.log('[Cron Import] Executando scraper AGU...');

      const aguResult = await scrapeAGU({
        tipos: ['orientacao-normativa'],
        filtroRelevancia: false, // cron importa tudo; admin filtra depois
      });
      const aguOrientacoes: AGUDocument[] = aguResult.results[0]?.documentos ?? [];

      // Delega ao helper com versionamento: ele deduplica por onNumber+onYear
      // (regra do projeto), grava o titulo canonico e o content, e mantem o
      // historico de versoes. Nao reimplementar a importacao aqui: a versao
      // anterior deduplicava por `title: on.numero` (abreviado), que nunca casa
      // com o titulo canonico do import do admin -- e por isso criava um
      // registro-fantasma por ON, sem content e sem url (57 em producao,
      // removidos em 15/07). Ver docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
      const importResult = await importOrientacoesNormativasWithVersioning(
        aguOrientacoes,
        // Cron importa sem curadoria: ON entra privada ate o admin revisar.
        { isPublic: false, reviewed: false, courseId: '2', isCommon: true },
      );

      results.agu.success = true;
      results.agu.count = importResult.novos;
      console.log(
        `[Cron Import] AGU: ${importResult.novos} novas, ${importResult.atualizados} atualizadas, ` +
        `${importResult.semMudancas} sem mudancas, ${importResult.erros} erros`
      );

    } catch (error) {
      apiLogger.error({ err: error }, '[Cron Import] Erro no scraper AGU:');
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
