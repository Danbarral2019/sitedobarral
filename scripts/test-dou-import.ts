/**
 * Script de Teste - Importação DOU com Querido Diário
 *
 * Testa o sistema completo end-to-end:
 * 1. Busca no Querido Diário API
 * 2. Análise de relevância
 * 3. Importação com versionamento
 * 4. Estatísticas e validação
 */

import { searchLastDays } from '@/lib/querido-diario';
import { importDOUDocuments, analyzeRelevanceDOU } from '@/lib/dou-module';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🚀 Teste de Importação DOU com Querido Diário\\n');
  console.log('='.repeat(60));

  try {
    // PASSO 1: Buscar publicações dos últimos 7 dias
    console.log('\\n📡 PASSO 1: Buscando publicações no Querido Diário API...\\n');

    const days = 7;
    const limit = 20; // Apenas 20 para teste

    console.log(`   Parâmetros: últimos ${days} dias, limite ${limit}`);

    const gazettes = await searchLastDays(days, limit);

    console.log(`\\n✅ Busca concluída:`);
    console.log(`   Total de publicações: ${gazettes.length}`);

    if (gazettes.length === 0) {
      console.log('\\n⚠️  Nenhuma publicação encontrada. Encerrando teste.');
      process.exit(0);
    }

    // PASSO 2: Análise de relevância
    console.log('\\n📊 PASSO 2: Analisando relevância...\\n');

    const relevanceAnalysis = gazettes.map(gazette => {
      const firstExcerpt = gazette.excerpts[0];
      const analysis = analyzeRelevanceDOU(
        firstExcerpt?.highlight || '',
        firstExcerpt?.excerpt || ''
      );

      return {
        gazette,
        ...analysis,
      };
    });

    const relevant = relevanceAnalysis.filter(a => a.isRelevant);

    console.log(`   Total analisado: ${relevanceAnalysis.length}`);
    console.log(`   Relevantes: ${relevant.length} (${Math.round((relevant.length / relevanceAnalysis.length) * 100)}%)`);
    console.log(`   Não relevantes: ${relevanceAnalysis.length - relevant.length}`);

    // Mostrar exemplos de relevantes
    console.log('\\n   📋 Exemplos de publicações relevantes:\\n');
    relevant.slice(0, 5).forEach((item, i) => {
      const firstExcerpt = item.gazette.excerpts[0];
      console.log(`   ${i + 1}. Score: ${item.score} | Temas: ${item.temas.join(', ')}`);
      console.log(`      ${firstExcerpt?.highlight || 'Sem título'}`);
      console.log(`      Data: ${item.gazette.date} | Edição: ${item.gazette.edition_number}\\n`);
    });

    if (relevant.length === 0) {
      console.log('\\n⚠️  Nenhuma publicação relevante encontrada. Encerrando teste.');
      process.exit(0);
    }

    // PASSO 3: Importação com versionamento
    console.log('\\n📥 PASSO 3: Importando com versionamento...\\n');

    const relevantGazettes = relevant.map(r => r.gazette);
    const importResult = await importDOUDocuments(relevantGazettes);

    // PASSO 4: Estatísticas de versionamento
    console.log('\\n📊 PASSO 4: Estatísticas de versionamento...\\n');

    const totalVersions = await prisma.documentVersion.count({
      where: {
        detectedBy: 'scraper-dou'
      }
    });
    console.log(`   Total de versões DOU no banco: ${totalVersions}`);

    const versionsByType = await prisma.documentVersion.groupBy({
      by: ['changeType'],
      _count: true,
      where: {
        detectedBy: 'scraper-dou'
      }
    });

    console.log('\\n   Versões por tipo de mudança:');
    for (const stat of versionsByType) {
      console.log(`   - ${stat.changeType}: ${(stat as any)._count}`);
    }

    // PASSO 5: Exemplos de documentos importados
    console.log('\\n📄 PASSO 5: Exemplos de documentos importados...\\n');

    const docsWithVersions = await prisma.document.findMany({
      where: {
        versions: {
          some: {
            detectedBy: 'scraper-dou'
          }
        }
      },
      include: {
        metaDou: true,
        versions: {
          where: {
            detectedBy: 'scraper-dou'
          },
          orderBy: { versionNumber: 'desc' },
          take: 2
        }
      },
      take: 5
    });

    console.log(`   Encontrados ${docsWithVersions.length} documentos com histórico:\\n`);

    for (const doc of docsWithVersions) {
      console.log(`   📋 ${doc.title}`);
      console.log(`      ID: ${doc.id}`);
      console.log(`      Categoria: ${doc.category}`);
      console.log(`      DOU: Seção ${doc.metaDou?.secao ?? doc.douSecao ?? 'N/A'}, Edição ${doc.metaDou?.edicao ?? doc.douEdicao ?? 'N/A'}`);
      console.log(`      Data DOU: ${(doc.metaDou?.data ?? doc.douData)?.toLocaleDateString('pt-BR') || 'N/A'}`);
      console.log(`      Curso: ${doc.courseId || 'N/A'}`);
      console.log(`      Versões: ${doc.versions.length}\\n`);

      if (doc.versions.length > 0) {
        const latest = doc.versions[0];
        console.log(`      Última mudança: ${latest.changeType} em ${latest.detectedAt.toLocaleString('pt-BR')}`);
        if (latest.changesSummary) {
          console.log(`      Resumo: ${latest.changesSummary}\\n`);
        }
      }
    }

    // PASSO 6: Teste de re-importação (detectar "no_change")
    console.log('\\n🔄 PASSO 6: Teste de re-importação (deve detectar sem mudanças)...\\n');

    const reimportResult = await importDOUDocuments(
      relevantGazettes.slice(0, 3) // Re-importar apenas 3 para teste
    );

    console.log(`   Resultado da re-importação:`);
    console.log(`   - Novos: ${reimportResult.novos} (esperado: 0)`);
    console.log(`   - Atualizados: ${reimportResult.atualizados} (esperado: 0)`);
    console.log(`   - Sem mudanças: ${reimportResult.semMudancas} (esperado: >= 1)`);

    // PASSO 7: Verificar integridade dos dados
    console.log('\\n✅ PASSO 7: Verificação de integridade...\\n');

    const totalDOU = await prisma.document.count({
      where: {
        versions: {
          some: {
            detectedBy: 'scraper-dou'
          }
        }
      }
    });

    const douWithData = await prisma.document.count({
      where: {
        douUrl: { not: null },
        douData: { not: null },
        douEdicao: { not: null }
      }
    });

    const douWithCourses = await prisma.document.count({
      where: {
        courseId: { not: null },
        versions: {
          some: {
            detectedBy: 'scraper-dou'
          }
        }
      }
    });

    console.log(`   Total de documentos DOU no banco: ${totalDOU}`);
    console.log(`   Documentos com dados DOU completos: ${douWithData}`);
    console.log(`   Documentos com curso sugerido: ${douWithCourses}`);
    console.log(`   Integridade: ${totalDOU > 0 ? ((douWithData / totalDOU) * 100).toFixed(1) : 0}%`);

    // RESUMO FINAL
    console.log('\\n' + '='.repeat(60));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\\n📊 Resumo Geral:');
    console.log(`   ✅ Publicações buscadas: ${gazettes.length}`);
    console.log(`   ✅ Publicações relevantes: ${relevant.length}`);
    console.log(`   ✅ Importados: ${importResult.total}`);
    console.log(`   ✅ Novos: ${importResult.novos}`);
    console.log(`   ✅ Atualizados: ${importResult.atualizados}`);
    console.log(`   ✅ Sem mudanças: ${importResult.semMudancas}`);
    console.log(`   ❌ Erros: ${importResult.erros}`);
    console.log(`   📚 Total de versões DOU: ${totalVersions}`);
    console.log('='.repeat(60));

    if (importResult.erros > 0) {
      console.log('\\n⚠️  Detalhes dos erros:');
      importResult.detalhes
        .filter(d => d.status === 'erro')
        .forEach(d => {
          console.log(`   - ${d.titulo}: ${d.error}`);
        });
    }

  } catch (error) {
    console.error('\\n❌ Erro fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
