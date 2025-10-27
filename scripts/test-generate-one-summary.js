/**
 * Script para testar geração de um resumo via API
 */

// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

async function main() {
  const documentId = '8a1af8b5-cb2b-4268-a670-86b3f64e7fbb'; // ON nº 28/2009

  console.log('🤖 Testando geração de resumo automático...\n');
  console.log(`📄 Documento ID: ${documentId}\n`);

  try {
    // Fazer requisição POST para gerar resumo
    const response = await fetch(`http://localhost:3000/api/admin/documents/${documentId}/generate-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Precisaria de token de autenticação, mas para teste vamos tentar...
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Erro:', error);
      console.log('\n⚠️  NOTA: Este endpoint requer autenticação de admin.');
      console.log('   Teste manualmente através do painel admin em:');
      console.log(`   http://localhost:3000/admin/documentos/${documentId}/edit\n`);
      return;
    }

    const data = await response.json();
    console.log('✅ Resumo gerado com sucesso!\n');
    console.log('📝 RESUMO:');
    console.log(data.summary.summary);
    console.log('\n📌 DESTAQUES:');
    data.summary.highlights.forEach((h, i) => console.log(`   ${i + 1}. ${h}`));
    console.log('\n🏷️  TAGS:');
    console.log('  ', data.summary.tags.join(', '));
    console.log(`\n💯 CONFIANÇA: ${data.summary.confidence}%`);

  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
    console.log('\n⚠️  NOTA: Este endpoint requer autenticação de admin.');
    console.log('   Teste manualmente através do painel admin em:');
    console.log(`   http://localhost:3000/admin/documentos/${documentId}/edit\n`);
  }
}

main();
