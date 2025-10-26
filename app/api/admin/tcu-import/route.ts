import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { fetchAcordaosTCU, convertAcordaosToDocuments, generateImportStats } from '@/lib/tcu-scraper';
import { addDocument } from '@/lib/documents';
import { prisma } from '@/lib/prisma';

/**
 * GET: Busca preview de acórdãos do TCU
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const inicio = parseInt(searchParams.get('inicio') || '0');
    const quantidade = parseInt(searchParams.get('quantidade') || '100');
    const anoInicio = searchParams.get('anoInicio') ? parseInt(searchParams.get('anoInicio')!) : undefined;
    const anoFim = searchParams.get('anoFim') ? parseInt(searchParams.get('anoFim')!) : undefined;
    const onlyRelevant = searchParams.get('onlyRelevant') !== 'false'; // true por padrão

    console.log('[TCU Import API] Buscando preview...', { inicio, quantidade, anoInicio, anoFim, onlyRelevant });

    // 1. Busca acórdãos do TCU
    const acordaos = await fetchAcordaosTCU({
      inicio,
      quantidade,
      anoInicio,
      anoFim,
      onlyRelevant,
    });

    console.log(`[TCU Import API] ${acordaos.length} acórdãos encontrados`);

    // 2. Converte para documentos
    const documents = convertAcordaosToDocuments(acordaos);

    console.log(`[TCU Import API] ${documents.length} documentos convertidos`);

    // 3. Verifica quais já existem no banco
    const existingAcordaos = await prisma.document.findMany({
      where: {
        category: 'acordao',
        onNumber: {
          in: documents.map(d => d.acordaoNumero)
        },
        onYear: {
          in: documents.map(d => d.acordaoAno)
        }
      },
      select: {
        onNumber: true,
        onYear: true,
        title: true,
      }
    });

    const existingKeys = new Set(
      existingAcordaos.map(doc => `${doc.onNumber}/${doc.onYear}`)
    );

    // 4. Separa novos e existentes
    const novos = acordaos.filter(ac =>
      !existingKeys.has(`${ac.acordaoNumero}/${ac.acordaoAno}`)
    );

    const existentes = acordaos.filter(ac =>
      existingKeys.has(`${ac.acordaoNumero}/${ac.acordaoAno}`)
    );

    console.log(`[TCU Import API] ${novos.length} novos, ${existentes.length} já existentes`);

    // 5. Gera estatísticas
    const stats = generateImportStats(acordaos);

    return NextResponse.json({
      success: true,
      total: acordaos.length,
      novos: novos.length,
      existentes: existentes.length,
      stats,
      preview: acordaos.slice(0, 10).map(ac => ({
        ...ac,
        isNovo: !existingKeys.has(`${ac.acordaoNumero}/${ac.acordaoAno}`),
      })),
    });

  } catch (error) {
    console.error('[TCU Import API] Erro ao buscar acórdãos:', error);
    return NextResponse.json(
      {
        error: 'Erro ao buscar acórdãos do TCU',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
});

/**
 * POST: Importa acórdãos do TCU
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      inicio = 0,
      quantidade = 100,
      anoInicio,
      anoFim,
      onlyRelevant = true,
      mode = 'incremental' // 'incremental' | 'completo'
    } = body;

    console.log(`[TCU Import API] Iniciando importação no modo: ${mode}...`);

    // 1. Busca acórdãos do TCU
    const acordaos = await fetchAcordaosTCU({
      inicio,
      quantidade,
      anoInicio,
      anoFim,
      onlyRelevant,
    });

    console.log(`[TCU Import API] ${acordaos.length} acórdãos encontrados`);

    // 2. Converte para documentos
    const documents = convertAcordaosToDocuments(acordaos);

    if (documents.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nenhum acórdão relevante encontrado para importar',
      });
    }

    // 3. Busca acórdãos existentes
    const existingAcordaos = await prisma.document.findMany({
      where: {
        category: 'acordao',
      },
      select: {
        onNumber: true,
        onYear: true,
        courseId: true,
        id: true,
      }
    });

    // Mapa: "numero/ano" -> Set de courseIds
    const existingMap = new Map<string, Set<string>>();
    for (const doc of existingAcordaos) {
      const key = `${doc.onNumber}/${doc.onYear}`;
      if (!existingMap.has(key)) {
        existingMap.set(key, new Set());
      }
      existingMap.get(key)!.add(doc.courseId);
    }

    // 4. Importa cada acórdão para cada curso sugerido
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const createdDocuments = [];

    const BATCH_SIZE = 50;
    const DELAY_BETWEEN_BATCHES = 500;
    let totalOperations = 0;

    for (const doc of documents) {
      const key = `${doc.acordaoNumero}/${doc.acordaoAno}`;

      for (const courseId of doc.courseIds) {
        try {
          const existsInCourse = existingMap.get(key)?.has(courseId);

          // MODO INCREMENTAL: Pula se já existe
          if (mode === 'incremental' && existsInCourse) {
            skippedCount++;
            totalOperations++;
            continue;
          }

          // MODO COMPLETO: Também pula duplicatas
          if (existsInCourse) {
            skippedCount++;
            totalOperations++;
            continue;
          }

          // Cria documento
          const created = await addDocument(
            courseId,
            doc.title,
            doc.description,
            doc.type as 'pdf' | 'link',
            'acordao',
            true, // isPublic
            doc.url,
            undefined, // size
            doc.tags,
            [], // leiArticles
            undefined, // alternativeUrls
            doc.acordaoNumero, // onNumber
            doc.acordaoAno // onYear
          );

          createdDocuments.push(created);
          successCount++;
          totalOperations++;

          // Delay a cada BATCH_SIZE operações
          if (totalOperations % BATCH_SIZE === 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            console.log(`[TCU Import API] Processados ${totalOperations}...`);
          }

        } catch (error) {
          console.error(`[TCU Import API] Erro ao importar ${doc.title} para curso ${courseId}:`, error);
          errorCount++;
        }
      }
    }

    // 5. Gera estatísticas finais
    const stats = generateImportStats(acordaos);

    console.log(`[TCU Import API] Importação concluída: ${successCount} criados, ${skippedCount} pulados, ${errorCount} erros`);

    return NextResponse.json({
      success: true,
      message: `Importação concluída no modo ${mode}`,
      mode,
      stats: {
        ...stats,
        documentosCriados: successCount,
        documentosPulados: skippedCount,
        erros: errorCount,
        totalProcessado: totalOperations,
      },
      documents: createdDocuments.slice(0, 5), // Primeiros 5 como exemplo
    });

  } catch (error) {
    console.error('[TCU Import API] Erro na importação:', error);
    return NextResponse.json(
      {
        error: 'Erro ao importar acórdãos do TCU',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
});
