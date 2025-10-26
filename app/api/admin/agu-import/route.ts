import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { scrapeOrientacoesAGU, convertOrientacoesToDocuments } from '@/lib/agu-scraper';
import { addDocument } from '@/lib/documents';
import { courses } from '@/data/courses';
import { prisma } from '@/lib/prisma';

/**
 * GET: Busca orientações da AGU (preview)
 */
export const GET = withAdminAuth(async () => {
  try {
    console.log('[AGU Import] Iniciando scraping...');

    const orientacoes = await scrapeOrientacoesAGU();

    console.log(`[AGU Import] ${orientacoes.length} orientações encontradas`);

    return NextResponse.json({
      success: true,
      count: orientacoes.length,
      orientacoes: orientacoes.slice(0, 10), // Preview das primeiras 10
      total: orientacoes.length,
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
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { addToAllCourses = true, makePublic = true } = body;

    console.log('[AGU Import] Iniciando importação automatizada...');

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

    // 4. Importa cada orientação para cada curso (em lotes para não sobrecarregar)
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const createdDocuments = [];

    const BATCH_SIZE = 50; // Processa 50 documentos por vez
    const DELAY_BETWEEN_BATCHES = 500; // 500ms de delay entre lotes

    let totalOperations = 0;
    for (const doc of documents) {
      for (const courseId of targetCourses) {
        try {
          // Verificar se documento já existe (por título e curso, ou por URL e curso)
          const existing = await prisma.document.findFirst({
            where: {
              courseId,
              OR: [
                { title: doc.title },
                { url: doc.url }
              ]
            }
          });

          if (existing) {
            console.log(`[AGU Import] Documento já existe: ${doc.title} (curso: ${courseId})`);
            skippedCount++;
            totalOperations++;
            continue; // Pula para o próximo
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
            [] // leiArticles (vazio)
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

    console.log(`[AGU Import] Importação concluída: ${successCount} criados, ${skippedCount} duplicados (pulados), ${errorCount} erros`);

    return NextResponse.json({
      success: true,
      message: `Importação concluída`,
      stats: {
        orientacoesEncontradas: orientacoes.length,
        cursosAlvo: targetCourses.length,
        documentosCriados: successCount,
        documentosDuplicados: skippedCount,
        erros: errorCount,
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
