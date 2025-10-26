/**
 * Teste FORÇADO com Claude AI
 * Este teste usa um documento ambíguo para forçar análise com Claude
 *
 * Uso:
 *   npx tsx scripts/test-claude-force.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Carrega .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { classifyDocumentEnhanced } from '../lib/auto-classifier';

async function testWithClaude() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  TESTE FORÇADO COM CLAUDE AI');
  console.log('  (Documento ambíguo para testar análise avançada)');
  console.log('═══════════════════════════════════════════════════\n');

  // Documento propositalmente ambíguo (baixa confiança na análise básica)
  const ambiguousDoc = {
    title: 'Decisão sobre aplicação de multa em procedimento administrativo',
    description: 'Análise de caso envolvendo aplicação de penalidades em contrato administrativo após fase de execução com problemas na prestação de serviços de tecnologia.',
  };

  console.log('📄 Documento ambíguo (para forçar uso do Claude):\n');
  console.log(`   Título: ${ambiguousDoc.title}`);
  console.log(`   Descrição: ${ambiguousDoc.description}\n`);
  console.log('   ⚠ Este documento pode se encaixar em múltiplos cursos:');
  console.log('      - Processo Administrativo Sancionador (penalidades)');
  console.log('      - Gestão e Fiscalização (execução contratual)');
  console.log('      - Nova Lei de Licitações (contratos)');
  console.log('');

  console.log('⏳ Aguardando análise do Claude...\n');

  try {
    const startTime = Date.now();
    const result = await classifyDocumentEnhanced(
      ambiguousDoc.title,
      ambiguousDoc.description,
      false // Permite Claude
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✓ Análise concluída em ${duration}s\n`);

    console.log('═══════════════════════════════════════════════════');
    console.log('  RESULTADO DA ANÁLISE');
    console.log('═══════════════════════════════════════════════════\n');

    console.log(`📊 Fonte: ${result.source.toUpperCase()}`);

    if (result.source === 'claude') {
      console.log('   ✓ Claude AI foi utilizado! (análise semântica avançada)\n');
    } else {
      console.log('   ⚠ Análise básica foi usada (confiança acima do limiar)\n');
    }

    console.log(`📚 Cursos sugeridos (${result.courseSlugs.length}):`);
    result.courseSlugs.forEach((slug, i) => {
      console.log(`   ${i + 1}. ${slug}`);
    });
    console.log('');

    console.log(`📂 Categoria: ${result.category}`);
    console.log(`📈 Confiança: ${result.confidence}%`);
    console.log(`🏷️  Tags (${result.tags.length}): ${result.tags.slice(0, 8).join(', ')}`);

    if (result.reasoning) {
      console.log(`\n💬 Raciocínio do Claude:`);
      console.log(`   "${result.reasoning}"`);
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  ANÁLISE DETALHADA');
    console.log('═══════════════════════════════════════════════════\n');

    if (result.source === 'claude') {
      console.log('✅ SUCESSO! Claude AI analisou semanticamente o documento');
      console.log(`   - Tempo de resposta: ${duration}s`);
      console.log(`   - Múltiplos cursos identificados: ${result.courseSlugs.length > 1 ? 'Sim' : 'Não'}`);
      console.log(`   - Custo estimado: ~$0.0013 USD`);
      console.log(`   - Modelo usado: Claude 3.5 Haiku`);
    } else {
      console.log('ℹ️  Análise básica foi suficiente (alta confiança)');
      console.log('   Para forçar o Claude, teste com documento mais ambíguo');
    }

    console.log('\n✅ Teste concluído!');

  } catch (error: any) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testWithClaude().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
