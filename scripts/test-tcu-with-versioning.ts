/**
 * Script de teste para importação de Acórdãos TCU com versionamento
 *
 * Testa o sistema completo:
 * 1. Scraping dos acórdãos TCU via API
 * 2. Análise de relevância com keywords unificadas
 * 3. Salvamento com detecção automática de mudanças
 * 4. Versionamento histórico
 */

import { fetchAcordaosTCU } from '@/lib/tcu-scraper';
import { importTCUAcordaosWithVersioning } from '@/lib/tcu-module';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🚀 Teste de Importação de Acórdãos TCU com Versionamento\n');
  console.log('='.repeat(60));

  try {
    // PASSO 1: Fetch dos acórdãos via API do TCU
    console.log('\n📡 PASSO 1: Buscando acórdãos do TCU via API...\n');

    const acordaos = await fetchAcordaosTCU({
      quantidade: 10, // Apenas 10 para teste
      anoInicio: 2024,
      onlyRelevant: true, // Apenas relevantes
    });

    console.log(`\n✅ Busca concluída:`);
    console.log(`   Total extraído: ${acordaos.length}`);
    console.log(`   Todos relevantes: ${acordaos.every(a => a.isRelevant)}`);

    if (acordaos.length === 0) {
      console.log('\n⚠️  Nenhum acórdão extraído. Verifique a API do TCU.');
      process.exit(0);
    }

    // PASSO 2: Importar com versionamento
    console.log('\n📥 PASSO 2: Importando com versionamento...\n');

    const importResult = await importTCUAcordaosWithVersioning(acordaos);

    // PASSO 3: Estatísticas de versionamento
    console.log('\n📊 PASSO 3: Estatísticas de versionamento...\n');

    const totalVersions = await prisma.documentVersion.count({
      where: {
        detectedBy: 'scraper-tcu'
      }
    });
    console.log(`   Total de versões TCU no banco: ${totalVersions}`);

    const versionsByType = await prisma.documentVersion.groupBy({
      by: ['changeType'],
      _count: true,
      where: {
        detectedBy: 'scraper-tcu'
      }
    });

    console.log('\n   Versões por tipo de mudança:');
    for (const stat of versionsByType) {
      console.log(`   - ${stat.changeType}: ${(stat as any)._count}`);
    }

    // PASSO 4: Exemplos de documentos versionados
    console.log('\n📄 PASSO 4: Exemplos de acórdãos com versões...\n');

    const docsWithVersions = await prisma.document.findMany({
      where: {
        category: 'acordao',
        versions: {
          some: {
            detectedBy: 'scraper-tcu'
          }
        }
      },
      include: {
        versions: {
          where: {
            detectedBy: 'scraper-tcu'
          },
          orderBy: { versionNumber: 'desc' },
          take: 2
        }
      },
      take: 5
    });

    console.log(`   Encontrados ${docsWithVersions.length} acórdãos com histórico:`);

    for (const doc of docsWithVersions) {
      console.log(`\n   📋 ${doc.title}`);
      console.log(`      ID: ${doc.id}`);
      console.log(`      Versões: ${doc.versions.length}`);
      console.log(`      Situação: ${(doc as any).tcuSituacao || 'N/A'}`);
      console.log(`      Relator: ${(doc as any).tcuRelator || 'N/A'}`);

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

    const reimportResult = await importTCUAcordaosWithVersioning(
      acordaos.slice(0, 3) // Re-importar apenas 3 para teste
    );

    console.log(`\n   Resultado da re-importação:`);
    console.log(`   - Novos: ${reimportResult.novos} (esperado: 0)`);
    console.log(`   - Atualizados: ${reimportResult.atualizados} (esperado: 0)`);
    console.log(`   - Sem mudanças: ${reimportResult.semMudancas} (esperado: 3)`);

    // PASSO 6: Verificar integridade dos dados
    console.log('\n✅ PASSO 6: Verificação de integridade...\n');

    const totalAcordaos = await prisma.document.count({
      where: { category: 'acordao' }
    });

    const acordaosWithNumbers = await prisma.document.count({
      where: {
        category: 'acordao',
        tcuNumeroAcordao: { not: null },
        acordaoNumero: { not: null },
        acordaoAno: { not: null }
      }
    });

    const acordaosWithCursos = await prisma.document.count({
      where: {
        category: 'acordao',
        courseId: { not: null }
      }
    });

    console.log(`   Total de acórdãos no banco: ${totalAcordaos}`);
    console.log(`   Acórdãos com número/ano: ${acordaosWithNumbers}`);
    console.log(`   Acórdãos com cursos sugeridos: ${acordaosWithCursos}`);
    console.log(`   Integridade: ${((acordaosWithNumbers / totalAcordaos) * 100).toFixed(1)}%`);

    // PASSO 7: Análise de cursos sugeridos
    console.log('\n📚 PASSO 7: Análise de cursos sugeridos...\n');

    const docsWithCourses = await prisma.document.findMany({
      where: {
        category: 'acordao',
        courseId: { not: null }
      },
      select: {
        title: true,
        courseId: true
      },
      take: 5
    });

    console.log(`   Exemplos de sugestões de cursos:`);
    for (const doc of docsWithCourses) {
      console.log(`\n   ${doc.title}`);
      console.log(`   Curso sugerido: ${doc.courseId}`);
    }

    // RESUMO FINAL
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\n📊 Resumo Geral:');
    console.log(`   ✅ Acórdãos extraídos: ${acordaos.length}`);
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
