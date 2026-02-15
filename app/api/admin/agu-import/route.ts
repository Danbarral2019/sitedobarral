import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { scrapeAGU, convertAGUDocumentsToImport } from '@/lib/agu-scraper-v4';
import { addDocument } from '@/lib/documents';
import { courses } from '@/data/courses';
import { prisma } from '@/lib/prisma';

/**
 * GET: Busca orientações da AGU usando AGU Scraper v4 (preview com detecção de novas)
 */
export const GET = withAdminAuth(async () => {
  try {
    console.log('[AGU Import v4] Iniciando scraping...');

    // Usa AGU Scraper v4 - muito mais robusto!
    const result = await scrapeAGU({
      tipos: ['orientacao-normativa'],
      anoInicio: 2020, // Apenas ONs de 2020+
      filtroRelevancia: true, // Apenas relevantes para licitações/contratos
    });

    if (!result.success) {
      throw new Error(`Scraping falhou: ${result.errors.join(', ')}`);
    }

    const documentos = result.results.flatMap(r => r.documentos);
    console.log(`[AGU Import v4] ${documentos.length} orientações relevantes encontradas (2020+)`);
    console.log(`[AGU Import v4] Taxa de relevância: ${result.stats.taxaRelevancia.toFixed(1)}%`);

    // Converte para formato de importação
    const documents = convertAGUDocumentsToImport(documentos);

    // Verifica quais documentos já existem no banco
    const existingUrls = await prisma.document.findMany({
      where: {
        category: 'orientacao-normativa',
        url: {
          in: documents.map(d => d.url)
        }
      },
      select: {
        url: true,
        title: true,
        courseId: true,
      },
      distinct: ['url'],
    });

    const existingUrlSet = new Set(existingUrls.map(d => d.url));

    // Separa novas das existentes
    const novas = documentos.filter(doc => !existingUrlSet.has(doc.url));
    const existentes = documentos.filter(doc => existingUrlSet.has(doc.url));

    console.log(`[AGU Import v4] ${novas.length} novas, ${existentes.length} já existentes`);

    // Formata preview para o frontend
    const preview = documentos.slice(0, 10).map(doc => ({
      numero: doc.numero || 'N/A',
      titulo: doc.titulo,
      descricao: doc.descricao,
      tags: doc.tags,
      linkFundamentacao: doc.urlPDF || doc.url,
      fundamentacaoLinks: doc.urlsAlternativas || [doc.url],
      versaoHistorica: doc.versaoHistorica,
      isNova: !existingUrlSet.has(doc.url),
    }));

    return NextResponse.json({
      success: true,
      total: documentos.length,
      novas: novas.length,
      existentes: existentes.length,
      orientacoes: documentos.slice(0, 10),
      preview,
      stats: {
        ...result.stats,
        tempoExecucao: `${(result.executionTime / 1000).toFixed(2)}s`,
      },
    });
  } catch (error) {
    console.error('[AGU Import v4] Erro ao buscar orientações:', error);
    return NextResponse.json(
      {
        error: 'Erro ao buscar orientações da AGU',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
});

/**
 * POST: Importa orientações da AGU usando AGU Scraper v4
 *
 * Modos de importação:
 * - incremental (padrão): Importa apenas ONs novas
 * - completo: Reimporta tudo (ignora duplicatas existentes)
 * - atualizar: Atualiza dados de ONs existentes
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      addToAllCourses = true,
      makePublic = true,
      mode = 'incremental' // 'incremental' | 'completo' | 'atualizar'
    } = body;

    console.log(`[AGU Import v4] Iniciando importação no modo: ${mode}...`);

    // 1. Faz scraping usando AGU Scraper v4
    const result = await scrapeAGU({
      tipos: ['orientacao-normativa'],
      anoInicio: 2020,
      filtroRelevancia: true,
    });

    if (!result.success) {
      throw new Error(`Scraping falhou: ${result.errors.join(', ')}`);
    }

    const documentos = result.results.flatMap(r => r.documentos);
    console.log(`[AGU Import v4] ${documentos.length} orientações relevantes encontradas`);
    console.log(`[AGU Import v4] Score médio: ${result.stats.scoreMedio.toFixed(1)}/100`);

    // 2. Converte para formato de importação
    const documents = convertAGUDocumentsToImport(documentos);

    // 3. Define cursos alvo
    const targetCourses = addToAllCourses
      ? courses.map(c => c.id)
      : []; // Se não for todos, retorna vazio (não importa)

    if (targetCourses.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum curso selecionado para importação',
      }, { status: 400 });
    }

    // 4. Busca documentos existentes de uma vez (otimização)
    const existingDocs = await prisma.document.findMany({
      where: {
        category: 'orientacao-normativa',
      },
      select: {
        url: true,
        title: true,
        courseId: true,
        id: true,
      }
    });

    // Cria índices para busca rápida
    const existingByUrlAndCourse = new Map<string, Set<string>>();
    for (const doc of existingDocs) {
      const key = `${doc.url}`;
      if (!existingByUrlAndCourse.has(key)) {
        existingByUrlAndCourse.set(key, new Set());
      }
      existingByUrlAndCourse.get(key)!.add(doc.courseId || '');
    }

    // 5. Importa cada orientação para cada curso (em lotes para não sobrecarregar)
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    const createdDocuments = [];

    const BATCH_SIZE = 50; // Processa 50 documentos por vez
    const DELAY_BETWEEN_BATCHES = 500; // 500ms de delay entre lotes

    let totalOperations = 0;
    for (const doc of documents) {
      for (const courseId of targetCourses) {
        try {
          const docKey = `${doc.url}`;
          const existsInCourse = existingByUrlAndCourse.get(docKey)?.has(courseId);

          // MODO INCREMENTAL: Pula se já existe
          if (mode === 'incremental' && existsInCourse) {
            skippedCount++;
            totalOperations++;
            continue;
          }

          // MODO ATUALIZAR: Atualiza se existe
          if (mode === 'atualizar' && existsInCourse) {
            const existingDoc = existingDocs.find(d => d.url === doc.url && d.courseId === courseId);
            if (existingDoc) {
              await prisma.document.update({
                where: { id: existingDoc.id },
                data: {
                  title: doc.title,
                  description: doc.description,
                  tags: JSON.stringify(doc.tags),
                }
              });
              updatedCount++;
              totalOperations++;
              console.log(`[AGU Import] Atualizado: ${doc.title} (curso: ${courseId})`);
              continue;
            }
          }

          // MODO COMPLETO ou INCREMENTAL (se não existe): Cria novo
          if (existsInCourse && mode === 'completo') {
            skippedCount++;
            totalOperations++;
            continue; // No modo completo também pula duplicatas
          }

          const created = await addDocument(
            courseId,
            doc.title,
            doc.description,
            'link', // Tipo: link (pois são URLs externas)
            'orientacao-normativa',
            makePublic,
            doc.url,
            undefined, // size (não aplicável para links)
            doc.tags,
            [], // leiArticles (vazio)
            doc.alternativeUrls, // URLs alternativas para múltiplas fundamentações
            doc.onNumber, // Número da ON (para ordenação numérica)
            doc.onYear // Ano da ON (para ordenação numérica)
          );

          createdDocuments.push(created);
          successCount++;
          totalOperations++;

          // Delay a cada BATCH_SIZE operações para não sobrecarregar o Prisma
          if (totalOperations % BATCH_SIZE === 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            console.log(`[AGU Import] Processados ${totalOperations} de ${documents.length * targetCourses.length}...`);
          }
        } catch (error) {
          console.error(`[AGU Import] Erro ao importar ${doc.title} para curso ${courseId}:`, error);
          errorCount++;
        }
      }
    }

    console.log(`[AGU Import v4] Importação concluída (${mode}): ${successCount} criados, ${updatedCount} atualizados, ${skippedCount} pulados, ${errorCount} erros`);
    console.log(`[AGU Import v4] Distribuição por curso:`, result.stats.porCurso);

    return NextResponse.json({
      success: true,
      message: `Importação v4 concluída no modo ${mode}`,
      mode,
      stats: {
        orientacoesEncontradas: documentos.length,
        cursosAlvo: targetCourses.length,
        documentosCriados: successCount,
        documentosAtualizados: updatedCount,
        documentosPulados: skippedCount,
        erros: errorCount,
        totalProcessado: totalOperations,
        relevanciaMedia: result.stats.scoreMedio.toFixed(1),
        tempoExecucao: `${(result.executionTime / 1000).toFixed(2)}s`,
      },
      documents: createdDocuments.slice(0, 5), // Retorna primeiros 5 como exemplo
    });

  } catch (error) {
    console.error('[AGU Import v4] Erro na importação:', error);
    return NextResponse.json(
      {
        error: 'Erro ao importar orientações da AGU (v4)',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
});
