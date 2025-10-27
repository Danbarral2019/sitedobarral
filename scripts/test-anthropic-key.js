/**
 * Script para testar se a ANTHROPIC_API_KEY está configurada
 */

require('dotenv').config({ path: '.env.local' });

console.log('\n🔍 Teste de Configuração da API Anthropic\n');
console.log('═══════════════════════════════════════\n');

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.log('❌ ANTHROPIC_API_KEY não encontrada!');
  console.log('\n📝 Verifique se existe no arquivo .env.local:');
  console.log('   ANTHROPIC_API_KEY=sk-ant-api03-...\n');
  process.exit(1);
}

console.log('✅ ANTHROPIC_API_KEY encontrada!');
console.log(`   Prefixo: ${apiKey.substring(0, 20)}...`);
console.log(`   Tamanho: ${apiKey.length} caracteres`);

console.log('\n📊 Status:');
console.log('   Local (dev): ✅ Configurada');
console.log('   Vercel (prod): ✅ Configurada (confirmado pelo usuário)');

console.log('\n💡 Próximo passo:');
console.log('   1. Reinicie o servidor dev (npm run dev)');
console.log('   2. Teste a classificação no TCU Manager');
console.log('   3. Você deve ver "Confiança: 80-95%" ao invés de "60%"\n');
