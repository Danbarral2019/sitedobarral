import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { scrapeAGU, convertAGUDocumentsToImport } from '@/lib/agu-scraper-v4';
import { addDocument } from '@/lib/documents';
import { courses } from '@/data/courses';
import { prisma } from '@/lib/prisma';
import type { AGUDocumentType } from '@/lib/agu-types';

/**
 * GET: Busca documentos da AGU usando AGU Scraper v4 (preview com detecção de novas)
 *
 * Query params:
 * - tipos: Tipos de documentos separados por vírgula (ex: "orientacao-normativa,sumula")
 * - anoInicio: Ano inicial (ex: 2020)
 * - anoFim: Ano final (opcional)
 * - filtroRelevancia: "true" ou "false" (default: true)
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parse e validar tipos (allow-list para segurança)
    const ALLOWED_TYPES: AGUDocumentType[] = [
      'orientacao-normativa',
      'parecer-vinculante',
      'sumula',
      'parecer-conuni',
      'modelo',
      'guia',
      'nota-tecnica'
    ];

    const tiposParam = searchParams.get('tipos') || 'orientacao-normativa';
    const tipos = tiposParam.split(',')
      .map(t => t.trim())
      .filter(t => ALLOWED_TYPES.includes(t as AGUDocumentType)) as AGUDocumentType[];

    if (tipos.length === 0) {
      console.error(`[AGU Scrape v4] ❌ Nenhum tipo válido fornecido: ${tiposParam}`);
      return NextResponse.json(
        { error: 'Nenhum tipo de documento válido fornecido' },
        { status: 400 }
      );
    }

    // Validar anos (proteção contra DoS)
    const currentYear = new Date().getFullYear();
    const MIN_YEAR = 1990;
    const MAX_YEAR_RANGE = 10; // Máximo de 10 anos por request

    const anoInicioParam = searchParams.get('anoInicio');
    const anoInicio = anoInicioParam ? parseInt(anoInicioParam, 10) : 2020;

    if (isNaN(anoInicio) || anoInicio < MIN_YEAR || anoInicio > currentYear) {
      console.error(`[AGU Scrape v4] ❌ anoInicio inválido: ${anoInicioParam}`);
      return NextResponse.json(
        { error: `anoInicio deve estar entre ${MIN_YEAR} e ${currentYear}` },
        { status: 400 }
      );
    }

    const anoFimParam = searchParams.get('anoFim');
    const anoFim = anoFimParam ? parseInt(anoFimParam, 10) : undefined;

    if (anoFim !== undefined) {
      if (isNaN(anoFim) || anoFim > currentYear || anoFim < anoInicio) {
        console.error(`[AGU Scrape v4] ❌ anoFim inválido: ${anoFimParam}`);
        return NextResponse.json(
          { error: 'anoFim inválido ou anterior a anoInicio' },
          { status: 400 }
        );
      }

      if (anoFim - anoInicio > MAX_YEAR_RANGE) {
        console.error(`[AGU Scrape v4] ❌ Range muito grande: ${anoFim - anoInicio} anos`);
        return NextResponse.json(
          { error: `Range máximo permitido: ${MAX_YEAR_RANGE} anos (proteção DoS)` },
          { status: 400 }
        );
      }
    }

    const filtroRelevancia = searchParams.get('filtroRelevancia') !== 'false';

    console.log('[AGU Scrape v4] Iniciando scraping...');
    console.log(`[AGU Scrape v4] Tipos: ${tipos.join(', ')}`);
    console.log(`[AGU Scrape v4] Período: ${anoInicio}-${anoFim || 'atual'}`);

    // Usa AGU Scraper v4 - muito mais robusto!
    const result = await scrapeAGU({
      tipos,
      anoInicio,
      anoFim,
      filtroRelevancia,
    });

    if (!result.success) {
      throw new Error(`Scraping falhou: ${result.errors.join(', ')}`);
    }

    const documentos = result.results.flatMap(r => r.documentos);
    console.log(`[AGU Scrape v4] ${documentos.length} documentos relevantes encontrados`);
    console.log(`[AGU Scrape v4] Taxa de relevância: ${result.stats.taxaRelevancia.toFixed(1)}%`);

    // Verifica quais documentos já existem no banco (✅ FIX: usar 'documentos' diretamente)
    const existingUrls = await prisma.document.findMany({
      where: {
        category: {
          in: tipos,
        },
        url: {
          in: documentos.map(d => d.url) // ✅ CORRIGIDO: era 'documents', agora é 'documentos'
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

    console.log(`[AGU Scrape v4] ${novas.length} novas, ${existentes.length} já existentes`);

    // Formata preview para o frontend
    const preview = documentos.slice(0, 20).map(doc => ({
      tipo: doc.tipo,
      numero: doc.numero || 'N/A',
      titulo: doc.titulo,
      descricao: doc.descricao,
      tags: doc.tags,
      url: doc.url,
      urlPDF: doc.urlPDF,
      versaoHistorica: doc.versaoHistorica,
      relevanciaScore: doc.relevanciaScore,
      cursosIds: doc.cursosIds,
      isNova: !existingUrlSet.has(doc.url),
    }));

    return NextResponse.json({
      success: true,
      total: documentos.length,
      novas: novas.length,
      existentes: existentes.length,
      documentos: preview,
      stats: {
        ...result.stats,
        tempoExecucao: `${(result.executionTime / 1000).toFixed(2)}s`,
      },
    });
  } catch (error) {
    // Log detalhado no servidor (para debugging)
    console.error('[AGU Scrape v4] Erro ao buscar documentos:', error);

    // Retorno genérico para o cliente (segurança - não vazar detalhes internos)
    return NextResponse.json(
      { error: 'Erro interno ao processar scraping da AGU' },
      { status: 500 }
    );
  }
});

/**
 * POST: Importa documentos da AGU usando AGU Scraper v4
 *
 * Body:
 * {
 *   tipos: string[],
 *   anoInicio?: number,
 *   anoFim?: number,
 *   filtroRelevancia?: boolean,
 *   addToAllCourses?: boolean,
 *   makePublic?: boolean,
 *   mode?: 'incremental' | 'completo' | 'atualizar'
 * }
 *
 * Modos de importação:
 * - incremental (padrão): Importa apenas documentos novos
 * - completo: Reimporta tudo (ignora duplicatas existentes)
 * - atualizar: Atualiza dados de documentos existentes
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      tipos = ['orientacao-normativa'],
      anoInicio = 2020,
      anoFim,
      filtroRelevancia = true,
      addToAllCourses = true,
      makePublic = true,
      mode = 'incremental' // 'incremental' | 'completo' | 'atualizar'
    } = body;

    console.log(`[AGU Import v4] Iniciando importação no modo: ${mode}...`);
    console.log(`[AGU Import v4] Tipos: ${tipos.join(', ')}`);

    // 1. Faz scraping usando AGU Scraper v4
    const result = await scrapeAGU({
      tipos: tipos as AGUDocumentType[],
      anoInicio,
      anoFim,
      filtroRelevancia,
    });

    if (!result.success) {
      throw new Error(`Scraping falhou: ${result.errors.join(', ')}`);
    }

    const documentos = result.results.flatMap(r => r.documentos);
    console.log(`[AGU Import v4] ${documentos.length} documentos relevantes encontrados`);
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
        category: {
          in: tipos,
        },
      },
      select: {
        url: true,
        title: true,
        courseId: true,
        id: true,
        category: true,
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

    // 5. Importa cada documento para cada curso (em lotes para não sobrecarregar)
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
            doc.category,
            makePublic,
            doc.url,
            undefined, // size (não aplicável para links)
            doc.tags,
            [], // leiArticles (vazio)
            doc.alternativeUrls, // URLs alternativas para múltiplas fundamentações (ONs)
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
    console.log(`[AGU Import v4] Distribuição por tipo:`, result.stats.porTipo);

    return NextResponse.json({
      success: true,
      message: `Importação v4 concluída no modo ${mode}`,
      mode,
      stats: {
        documentosEncontrados: documentos.length,
        cursosAlvo: targetCourses.length,
        documentosCriados: successCount,
        documentosAtualizados: updatedCount,
        documentosPulados: skippedCount,
        erros: errorCount,
        totalProcessado: totalOperations,
        relevanciaMedia: result.stats.scoreMedio.toFixed(1),
        tempoExecucao: `${(result.executionTime / 1000).toFixed(2)}s`,
        porTipo: result.stats.porTipo,
      },
      documents: createdDocuments.slice(0, 5), // Retorna primeiros 5 como exemplo
    });

  } catch (error) {
    console.error('[AGU Import v4] Erro na importação:', error);
    return NextResponse.json(
      {
        error: 'Erro ao importar documentos da AGU (v4)',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
});
