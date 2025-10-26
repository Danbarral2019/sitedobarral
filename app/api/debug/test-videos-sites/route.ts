import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Endpoint de diagnóstico para testar busca de vídeos e sites
 * Acesse: /api/debug/test-videos-sites
 */
export async function GET() {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    logs.push('1. Iniciando teste de vídeos e sites...');

    // Teste 1: Verificar se tabela CourseVideo existe e contar
    logs.push('2. Testando tabela CourseVideo...');
    try {
      const videoCount = await prisma.courseVideo.count();
      logs.push(`   ✅ Tabela CourseVideo existe. Total: ${videoCount} vídeos`);
    } catch (error) {
      logs.push(`   ❌ ERRO na tabela CourseVideo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      throw error;
    }

    // Teste 2: Buscar vídeos com todos os campos (como batch-data faz)
    logs.push('3. Buscando vídeos com todos os campos...');
    try {
      const videos = await prisma.courseVideo.findMany({
        where: {
          courseId: { in: ['1', '2', '3'] },
          isActive: true,
        },
        orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          courseId: true,
          title: true,
          description: true,
          youtubeUrl: true,
          youtubeId: true,
          thumbnailUrl: true,
          displayOrder: true,
        },
        take: 5
      });
      logs.push(`   ✅ Vídeos encontrados: ${videos.length}`);
      if (videos.length > 0) {
        logs.push(`   Exemplos: ${videos.map(v => v.title).join(', ')}`);
      }
    } catch (error) {
      logs.push(`   ❌ ERRO ao buscar vídeos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      throw error;
    }

    // Teste 3: Verificar se tabela SiteToCourse existe
    logs.push('4. Testando tabela SiteToCourse...');
    try {
      const siteToCourseCount = await prisma.siteToCourse.count();
      logs.push(`   ✅ Tabela SiteToCourse existe. Total: ${siteToCourseCount} relações`);
    } catch (error) {
      logs.push(`   ❌ ERRO na tabela SiteToCourse: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      throw error;
    }

    // Teste 4: Verificar se tabela RecommendedSite existe
    logs.push('5. Testando tabela RecommendedSite...');
    try {
      const siteCount = await prisma.recommendedSite.count();
      logs.push(`   ✅ Tabela RecommendedSite existe. Total: ${siteCount} sites`);
    } catch (error) {
      logs.push(`   ❌ ERRO na tabela RecommendedSite: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      throw error;
    }

    // Teste 5: Buscar sites com include (como batch-data faz)
    logs.push('6. Buscando sites com include (como batch-data faz)...');
    try {
      const siteToCourse = await prisma.siteToCourse.findMany({
        where: {
          courseId: { in: ['1', '2', '3'] },
        },
        orderBy: [
          { displayOrder: 'asc' },
        ],
        include: {
          site: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
              title: true,
              description: true,
              url: true,
              faviconUrl: true,
              category: true,
            },
          },
        },
        take: 5
      });
      logs.push(`   ✅ Sites encontrados: ${siteToCourse.length}`);
      if (siteToCourse.length > 0) {
        const sitesComDados = siteToCourse.filter(s => s.site).length;
        logs.push(`   Sites com dados: ${sitesComDados}`);
      }
    } catch (error) {
      logs.push(`   ❌ ERRO ao buscar sites: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      logs.push(`   Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
      throw error;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    logs.push(`\n✅ TODOS OS TESTES DE VÍDEOS E SITES PASSARAM! (${duration}ms)`);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      logs
    });

  } catch (error) {
    logs.push(`\n❌ ERRO ENCONTRADO!`);
    logs.push(`Mensagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    logs.push(`Stack trace: ${error instanceof Error ? error.stack : 'N/A'}`);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      logs
    }, { status: 500 });
  }
}
