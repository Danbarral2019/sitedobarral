import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { scrapeOrientacoesAGU, convertOrientacoesToDocuments } from '@/lib/agu-scraper';
import { addDocument } from '@/lib/documents';
import { courses } from '@/data/courses';
import { prisma } from '@/lib/prisma';

/**
 * GET: Busca orientações da AGU (preview com detecção de novas)
 */
export const GET = withAdminAuth(async () => {
  try {
    console.log('[AGU Import] Iniciando scraping...');

    const orientacoes = await scrapeOrientacoesAGU();
    console.log(`[AGU Import] ${orientacoes.length} orientações encontradas no site da AGU`);

    // Converte para documentos para verificar quais já existem
    const documents = convertOrientacoesToDocuments(orientacoes);

    // Verifica quais documentos já existem no banco (checando qualquer curso)
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
      distinct: ['url'], // Evita duplicatas (mesmo doc em vários cursos)
    });

    const existingUrlSet = new Set(existingUrls.map(d => d.url));

    // Separa orientações novas das existentes
    const novas = orientacoes.filter((on) => {
      const doc = documents.find(d => d.title.includes(on.numeroCompleto));
      return doc && !existingUrlSet.has(doc.url);
    });

    const existentes = orientacoes.filter((on) => {
      const doc = documents.find(d => d.title.includes(on.numeroCompleto));
      return doc && existingUrlSet.has(doc.url);
    });

    console.log(`[AGU Import] ${novas.length} novas, ${existentes.length} já existentes`);

    return NextResponse.json({
      success: true,
      total: orientacoes.length,
      novas: novas.length,
      existentes: existentes.length,
      orientacoes: orientacoes.slice(0, 10), // Preview das primeiras 10
      // Marca quais são novas no preview
      preview: orientacoes.slice(0, 10).map(on => {
        const doc = documents.find(d => d.title.includes(on.numeroCompleto));
        const isNova = doc && !existingUrlSet.has(doc.url);
        return {
          ...on,
          isNova,
        };
      }),
    });
  } catch (error) {
    console.error('[AGU Import] Erro ao buscar orientações:', error);
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
 * POST: Importa orientações da AGU para todos os cursos
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

    console.log(`[AGU Import] Iniciando importação no modo: ${mode}...`);

    // 1. Faz scraping das orientações
    const orientacoes = await scrapeOrientacoesAGU();
    console.log(`[AGU Import] ${orientacoes.length} orientações encontradas`);

    // 2. Converte para formato de documento
    const documents = convertOrientacoesToDocuments(orientacoes);

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
      existingByUrlAndCourse.get(key)!.add(doc.courseId);
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

    console.log(`[AGU Import] Importação concluída (${mode}): ${successCount} criados, ${updatedCount} atualizados, ${skippedCount} pulados, ${errorCount} erros`);

    return NextResponse.json({
      success: true,
      message: `Importação concluída no modo ${mode}`,
      mode,
      stats: {
        orientacoesEncontradas: orientacoes.length,
        cursosAlvo: targetCourses.length,
        documentosCriados: successCount,
        documentosAtualizados: updatedCount,
        documentosPulados: skippedCount,
        erros: errorCount,
        totalProcessado: totalOperations,
      },
      documents: createdDocuments.slice(0, 5), // Retorna primeiros 5 como exemplo
    });

  } catch (error) {
    console.error('[AGU Import] Erro na importação:', error);
    return NextResponse.json(
      {
        error: 'Erro ao importar orientações da AGU',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
});
