/**
 * Script de teste do scraper do TCU
 * Testa a integração com o webservice e exibe estatísticas
 */

import { fetchAcordaosTCU, convertAcordaosToDocuments, generateImportStats } from '../lib/tcu-scraper';

async function testTCUScraper() {
  console.log('🧪 Testando Scraper do TCU...\n');
  console.log('='.repeat(60));

  try {
    // Teste 1: Buscar 50 acórdãos mais recentes (apenas relevantes)
    console.log('\n📋 Teste 1: Buscar 50 acórdãos relevantes (ano atual)\n');

    const acordaos = await fetchAcordaosTCU({
      quantidade: 50,
      anoInicio: new Date().getFullYear(),
      onlyRelevant: true,
    });

    console.log(`✅ ${acordaos.length} acórdãos relevantes encontrados\n`);

    // Estatísticas
    const stats = generateImportStats(acordaos);

    console.log('📊 ESTATÍSTICAS:');
    console.log(`   Total analisados: ${stats.total}`);
    console.log(`   Relevantes: ${stats.relevant} (${Math.round(stats.relevant / stats.total * 100)}%)`);
    console.log(`   Irrelevantes: ${stats.irrelevant}`);
    console.log(`   Score médio: ${stats.avgScore.toFixed(1)}%`);

    // Distribuição por curso
    if (Object.keys(stats.byCourse).length > 0) {
      console.log('\n📚 DISTRIBUIÇÃO POR CURSO:');
      const courseNames: Record<string, string> = {
        '1': 'Nova Lei de Licitações',
        '2': 'Planejamento das Contratações',
        '3': 'Gestão e Fiscalização',
        '4': 'Processo Sancionador',
        '6': 'Terceirização e Formação de Preços',
        '8': 'Revisão, Reajuste e Repactuação',
        '9': 'Alterações Contratuais',
        '10': 'Contratação Direta',
      };

      Object.entries(stats.byCourse)
        .sort(([, a], [, b]) => b - a)
        .forEach(([courseId, count]) => {
          console.log(`   ${courseNames[courseId] || `Curso ${courseId}`}: ${count}`);
        });
    }

    // Distribuição por ano
    if (Object.keys(stats.byYear).length > 0) {
      console.log('\n📅 DISTRIBUIÇÃO POR ANO:');
      Object.entries(stats.byYear)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .forEach(([year, count]) => {
          console.log(`   ${year}: ${count}`);
        });
    }

    // Exemplos de acórdãos
    console.log('\n📄 EXEMPLOS (primeiros 5):');
    console.log('='.repeat(60));

    acordaos.slice(0, 5).forEach((ac, idx) => {
      console.log(`\n${idx + 1}. Acórdão TCU nº ${ac.numeroAcordao}/${ac.anoAcordao}`);
      console.log(`   Colegiado: ${ac.colegiado}`);
      console.log(`   Relator: ${ac.relator}`);
      console.log(`   Relevância: ${ac.relevanceScore}%`);
      console.log(`   Cursos: ${ac.suggestedCourses.join(', ')}`);
      console.log(`   Sumário: ${ac.sumario.substring(0, 150)}...`);
      console.log(`   PDF: ${ac.urlArquivoPDF ? '✓' : '✗'}`);
    });

    // Teste 2: Converter para documentos
    console.log('\n\n📋 Teste 2: Conversão para Documentos\n');

    const documents = convertAcordaosToDocuments(acordaos);

    console.log(`✅ ${documents.length} documentos gerados`);

    // Total de inserções (considerando multi-curso)
    const totalInsertions = documents.reduce((sum, doc) => sum + doc.courseIds.length, 0);
    console.log(`   Total de inserções no banco: ${totalInsertions} (multi-curso)`);

    console.log('\n📄 EXEMPLO DE DOCUMENTO:');
    console.log('='.repeat(60));

    if (documents.length > 0) {
      const doc = documents[0];
      console.log(JSON.stringify(doc, null, 2));
    }

    console.log('\n\n✅ TESTES CONCLUÍDOS COM SUCESSO!\n');
    console.log('='.repeat(60));
    console.log('\n💡 Próximos passos:');
    console.log('   1. Acesse http://localhost:3000/admin/tcu-import');
    console.log('   2. Configure os filtros desejados');
    console.log('   3. Clique em "Carregar Preview"');
    console.log('   4. Revise os acórdãos encontrados');
    console.log('   5. Clique em "Importar" para adicionar ao banco\n');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error instanceof Error ? error.message : 'Erro desconhecido');
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Executar teste
testTCUScraper();
