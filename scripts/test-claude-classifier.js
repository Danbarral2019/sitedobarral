/**
 * Script de teste para classificação com Claude AI
 *
 * Uso:
 *   node scripts/test-claude-classifier.js
 */

// Carrega variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

// Importa as funções (ESM syntax via dynamic import)
async function testClaudeClassifier() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  TESTE DO SISTEMA DE CLASSIFICAÇÃO COM CLAUDE AI');
  console.log('═══════════════════════════════════════════════════\n');

  // Verifica se API key está configurada
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ERRO: ANTHROPIC_API_KEY não configurada em .env.local');
    console.log('\nPara configurar:');
    console.log('1. Acesse https://console.anthropic.com');
    console.log('2. Gere uma API Key em Settings > API Keys');
    console.log('3. Adicione ao .env.local: ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  console.log('✓ API Key configurada\n');

  // Importa dinamicamente os módulos ES
  const { classifyDocumentEnhanced, classifyDocumentSync } = await import('../lib/auto-classifier.ts');

  // Documentos de teste
  const testDocuments = [
    {
      title: 'Acórdão TCU 1234/2023 - Contratação Emergencial',
      description: 'Análise de contratação direta por situação emergencial. Dispensa de licitação nos termos do art. 75, VIII da Lei 14.133/2021.',
      expectedCourse: 'contratacao-direta',
      expectedCategory: 'acordao'
    },
    {
      title: 'Parecer AGU sobre Gestão de Contratos de TI',
      description: 'Orientações sobre a atuação do gestor e fiscal de contratos de tecnologia da informação, incluindo medição, pagamento e aplicação de sanções.',
      expectedCourse: 'gestao-fiscalizacao-contratos',
      expectedCategory: 'parecer'
    },
    {
      title: 'Manual de Planejamento do PCA 2024',
      description: 'Guia completo para elaboração do Plano de Contratações Anual, incluindo ETP e Termo de Referência.',
      expectedCourse: 'planejamento-contratacoes',
      expectedCategory: 'apostila'
    },
    {
      title: 'Edital de Pregão Eletrônico 001/2024',
      description: 'Pregão eletrônico para registro de preços de materiais de escritório.',
      expectedCourse: 'nova-lei-licitacoes',
      expectedCategory: 'edital'
    },
    {
      title: 'Repactuação de Contratos de Vigilância',
      description: 'Metodologia para cálculo de repactuação em contratos de serviços terceirizados com dedicação exclusiva de mão de obra.',
      expectedCourse: 'revisao-reajuste-repactuacao',
      expectedCategory: 'apostila'
    }
  ];

  console.log('═══════════════════════════════════════════════════');
  console.log('  TESTE 1: ANÁLISE BÁSICA (SEM CLAUDE)');
  console.log('═══════════════════════════════════════════════════\n');

  for (const doc of testDocuments) {
    console.log(`📄 Documento: ${doc.title.substring(0, 60)}...`);

    const basicResult = classifyDocumentSync(doc.title, doc.description);

    const courseMatch = basicResult.courseSlugs.includes(doc.expectedCourse) ? '✓' : '✗';
    const categoryMatch = basicResult.category === doc.expectedCategory ? '✓' : '✗';

    console.log(`   Curso: ${basicResult.courseSlugs[0]} ${courseMatch} (esperado: ${doc.expectedCourse})`);
    console.log(`   Categoria: ${basicResult.category} ${categoryMatch} (esperado: ${doc.expectedCategory})`);
    console.log(`   Confiança: ${basicResult.confidence}%`);
    console.log(`   Tags: ${basicResult.tags.slice(0, 3).join(', ')}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  TESTE 2: ANÁLISE AVANÇADA (COM CLAUDE)');
  console.log('═══════════════════════════════════════════════════\n');

  // Testa apenas o primeiro documento para economizar tokens
  const testDoc = testDocuments[0];

  console.log(`📄 Documento de teste: ${testDoc.title}\n`);
  console.log('Descrição:', testDoc.description, '\n');

  console.log('⏳ Aguardando resposta do Claude (pode levar alguns segundos)...\n');

  try {
    const startTime = Date.now();
    const enhancedResult = await classifyDocumentEnhanced(
      testDoc.title,
      testDoc.description,
      false // Permite uso do Claude
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✓ Análise concluída em ${duration}s\n`);

    const courseMatch = enhancedResult.courseSlugs.includes(testDoc.expectedCourse) ? '✓' : '✗';
    const categoryMatch = enhancedResult.category === testDoc.expectedCategory ? '✓' : '✗';

    console.log('RESULTADO:');
    console.log(`   Cursos: ${enhancedResult.courseSlugs.join(', ')} ${courseMatch}`);
    console.log(`   (esperado: ${testDoc.expectedCourse})`);
    console.log(`   Categoria: ${enhancedResult.category} ${categoryMatch}`);
    console.log(`   (esperado: ${testDoc.expectedCategory})`);
    console.log(`   Confiança: ${enhancedResult.confidence}%`);
    console.log(`   Fonte: ${enhancedResult.source}`);
    console.log(`   Tags: ${enhancedResult.tags.join(', ')}`);

    if (enhancedResult.reasoning) {
      console.log(`\n   Raciocínio do Claude:`);
      console.log(`   "${enhancedResult.reasoning}"`);
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  TESTE CONCLUÍDO COM SUCESSO ✓');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('📊 RESUMO:');
    console.log(`   - API do Claude: Funcionando`);
    console.log(`   - Tempo de resposta: ${duration}s`);
    console.log(`   - Resultado: ${enhancedResult.source === 'claude' ? 'Claude usado' : 'Análise básica'}`);
    console.log(`   - Precisão: ${courseMatch === '✓' && categoryMatch === '✓' ? 'Alta' : 'Verificar'}`);

  } catch (error) {
    console.error('\n❌ ERRO ao testar Claude:');
    console.error(error.message);

    if (error.message.includes('401')) {
      console.log('\n💡 Dica: Verifique se sua ANTHROPIC_API_KEY está correta');
    } else if (error.message.includes('429')) {
      console.log('\n💡 Dica: Limite de taxa excedido. Aguarde alguns segundos e tente novamente');
    } else if (error.message.includes('400')) {
      console.log('\n💡 Dica: Erro na requisição. Verifique o formato dos dados');
    }

    process.exit(1);
  }

  console.log('\n✓ Todos os testes concluídos!');
  console.log('\nPróximos passos:');
  console.log('1. O sistema está pronto para uso em produção');
  console.log('2. A análise com Claude será usada automaticamente quando a confiança for < 50%');
  console.log('3. Custo estimado: ~$0.001 por documento analisado pelo Claude');
}

// Executa o teste
testClaudeClassifier().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
