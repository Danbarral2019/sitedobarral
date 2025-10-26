import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Endpoint de diagnóstico para testar busca de documentos
 * Acesse: /api/debug/test-docs
 */
export async function GET() {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    logs.push('1. Iniciando teste de busca de documentos...');

    // Teste 1: Contar documentos
    logs.push('2. Contando documentos totais...');
    const totalDocs = await prisma.document.count();
    logs.push(`   ✅ Total de documentos: ${totalDocs}`);

    // Teste 2: Contar ONs
    logs.push('3. Contando Orientações Normativas...');
    const totalONs = await prisma.document.count({
      where: { category: 'orientacao-normativa' }
    });
    logs.push(`   ✅ Total de ONs: ${totalONs}`);

    // Teste 3: Buscar documentos do curso 1
    logs.push('4. Buscando documentos do Curso 1...');
    const curso1Docs = await prisma.document.findMany({
      where: { courseId: '1' },
      take: 5,
      select: {
        id: true,
        title: true,
        category: true,
        courseId: true,
      }
    });
    logs.push(`   ✅ Documentos do Curso 1: ${curso1Docs.length} (primeiros 5)`);
    logs.push(`   Exemplos: ${curso1Docs.map(d => `[${d.category}] ${d.title.substring(0, 30)}...`).join(', ')}`);

    // Teste 4: Buscar com todos os campos (como a API faz)
    logs.push('5. Buscando com todos os campos (simulando API batch-data)...');
    const fullQuery = await prisma.document.findMany({
      where: {
        courseId: { in: ['1'] }
      },
      orderBy: [
        { uploadedAt: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        url: true,
        category: true,
        courseId: true,
        isPublic: true,
        tags: true,
        leiArticles: true,
        size: true,
        uploadedAt: true,
        updatedAt: true,
      },
      take: 3
    });
    logs.push(`   ✅ Query completa retornou: ${fullQuery.length} docs (primeiros 3)`);

    // Teste 5: Testar múltiplos cursos
    logs.push('6. Testando busca em múltiplos cursos (1-10)...');
    const multiCourseQuery = await prisma.document.findMany({
      where: {
        courseId: { in: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] }
      },
      select: {
        id: true,
        courseId: true,
      }
    });

    // Agrupar por curso
    const byCourse: Record<string, number> = {};
    multiCourseQuery.forEach(doc => {
      byCourse[doc.courseId] = (byCourse[doc.courseId] || 0) + 1;
    });

    logs.push(`   ✅ Documentos por curso: ${JSON.stringify(byCourse)}`);

    const endTime = Date.now();
    const duration = endTime - startTime;

    logs.push(`\n✅ TODOS OS TESTES PASSARAM! (${duration}ms)`);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      logs,
      summary: {
        totalDocumentos: totalDocs,
        totalONs: totalONs,
        porCurso: byCourse
      }
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

  } catch (error) {
    logs.push(`\n❌ ERRO: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    logs.push(`Stack trace: ${error instanceof Error ? error.stack : 'N/A'}`);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      logs
    }, { status: 500 });
  }
}
