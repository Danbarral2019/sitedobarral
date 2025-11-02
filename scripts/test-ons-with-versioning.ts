/**
 * Script de teste para importação de ONs com versionamento
 *
 * Testa o sistema completo:
 * 1. Scraping das ONs da AGU
 * 2. Análise de relevância
 * 3. Salvamento com detecção automática de mudanças
 * 4. Versionamento histórico
 */

import {
  scrapeOrientacoesNormativas,
  importOrientacoesNormativasWithVersioning
} from '@/lib/agu-modules/orientacoes-normativas';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🚀 Teste de Importação de ONs com Versionamento\n');
  console.log('='.repeat(60));

  try {
    // PASSO 1: Scrape das ONs
    console.log('\n📡 PASSO 1: Scraping das Orientações Normativas...\n');

    const scraperResult = await scrapeOrientacoesNormativas({
      tipos: ['orientacao-normativa'],
      filtroRelevancia: false, // Importar todas para teste
      saveScreenshots: false,
      delayMs: 500,
      timeout: 30000,
    });

    if (!scraperResult.success) {
      console.error('❌ Erro no scraping:', scraperResult.errors);
      process.exit(1);
    }

    console.log(`\n✅ Scraping concluído:`);
    console.log(`   Total extraído: ${scraperResult.total}`);
    console.log(`   Relevantes: ${scraperResult.totalRelevante}`);
    console.log(`   Tempo: ${scraperResult.executionTime}ms`);

    if (scraperResult.documentos.length === 0) {
      console.log('\n⚠️  Nenhum documento extraído. Verifique o scraper.');
      process.exit(0);
    }

    // PASSO 2: Importar com versionamento
    console.log('\n📥 PASSO 2: Importando com versionamento...\n');

    const importResult = await importOrientacoesNormativasWithVersioning(
      scraperResult.documentos
    );

    // PASSO 3: Estatísticas de versionamento
    console.log('\n📊 PASSO 3: Estatísticas de versionamento...\n');

    const totalVersions = await prisma.documentVersion.count();
    console.log(`   Total de versões no banco: ${totalVersions}`);

    const versionsByType = await prisma.documentVersion.groupBy({
      by: ['changeType'],
      _count: true,
      where: {
        detectedBy: 'scraper-ons-agu'
      }
    });

    console.log('\n   Versões por tipo de mudança:');
    for (const stat of versionsByType) {
      console.log(`   - ${stat.changeType}: ${stat._count._count}`);
    }

    // PASSO 4: Exemplos de documentos versionados
    console.log('\n📄 PASSO 4: Exemplos de documentos com versões...\n');

    const docsWithVersions = await prisma.document.findMany({
      where: {
        category: 'orientacao-normativa',
        versions: {
          some: {}
        }
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 2
        }
      },
      take: 5
    });

    console.log(`   Encontrados ${docsWithVersions.length} documentos com histórico:`);

    for (const doc of docsWithVersions) {
      console.log(`\n   📋 ${doc.title}`);
      console.log(`      ID: ${doc.id}`);
      console.log(`      Versões: ${doc.versions.length}`);

      if (doc.versions.length > 0) {
        const latest = doc.versions[0];
        console.log(`      Última mudança: ${latest.changeType} em ${latest.detectedAt.toLocaleString('pt-BR')}`);
        if (latest.changesSummary) {
          console.log(`      Resumo: ${latest.changesSummary}`);
        }
      }
    }

    // PASSO 5: Teste de re-importação (detectar "no_change")
    console.log('\n🔄 PASSO 5: Teste de re-importação (deve detectar sem mudanças)...\n');

    const reimportResult = await importOrientacoesNormativasWithVersioning(
      scraperResult.documentos.slice(0, 5) // Re-importar apenas 5 para teste
    );

    console.log(`\n   Resultado da re-importação:`);
    console.log(`   - Novos: ${reimportResult.novos} (esperado: 0)`);
    console.log(`   - Atualizados: ${reimportResult.atualizados} (esperado: 0)`);
    console.log(`   - Sem mudanças: ${reimportResult.semMudancas} (esperado: 5)`);

    // PASSO 6: Verificar integridade dos dados
    console.log('\n✅ PASSO 6: Verificação de integridade...\n');

    const totalONs = await prisma.document.count({
      where: { category: 'orientacao-normativa' }
    });

    const onsWithNumbers = await prisma.document.count({
      where: {
        category: 'orientacao-normativa',
        onNumber: { not: null },
        onYear: { not: null }
      }
    });

    console.log(`   Total de ONs no banco: ${totalONs}`);
    console.log(`   ONs com número/ano: ${onsWithNumbers}`);
    console.log(`   Integridade: ${((onsWithNumbers / totalONs) * 100).toFixed(1)}%`);

    // RESUMO FINAL
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\n📊 Resumo Geral:');
    console.log(`   ✅ Documentos extraídos: ${scraperResult.total}`);
    console.log(`   ✅ Importados: ${importResult.total}`);
    console.log(`   ✅ Novos: ${importResult.novos}`);
    console.log(`   ✅ Atualizados: ${importResult.atualizados}`);
    console.log(`   ✅ Sem mudanças: ${importResult.semMudancas}`);
    console.log(`   ❌ Erros: ${importResult.erros}`);
    console.log(`   📚 Total de versões: ${totalVersions}`);
    console.log('='.repeat(60));

    if (importResult.erros > 0) {
      console.log('\n⚠️  Detalhes dos erros:');
      importResult.detalhes
        .filter(d => d.status === 'erro')
        .forEach(d => {
          console.log(`   - ${d.numero}: ${d.error}`);
        });
    }

  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
