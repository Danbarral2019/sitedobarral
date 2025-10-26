/**
 * Script de teste para validar configuração da Claude API
 *
 * Uso:
 * node scripts/test-claude-api.js
 */

require('dotenv').config({ path: '.env.local' });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function testClaudeAPI() {
  console.log('\n🧪 TESTE DE CONFIGURAÇÃO - CLAUDE API\n');
  console.log('='.repeat(60));

  // 1. Verificar se API key está configurada
  console.log('\n1️⃣ Verificando API Key...');

  if (!ANTHROPIC_API_KEY) {
    console.log('❌ ERRO: ANTHROPIC_API_KEY não encontrada no .env.local');
    console.log('\n📝 Para configurar:');
    console.log('   1. Crie conta em: https://console.anthropic.com');
    console.log('   2. Gere API Key em: Settings → API Keys');
    console.log('   3. Adicione no .env.local:');
    console.log('      ANTHROPIC_API_KEY=sk-ant-api03-xxxxx\n');
    process.exit(1);
  }

  console.log('✅ API Key encontrada:', ANTHROPIC_API_KEY.substring(0, 20) + '...');

  // 2. Validar formato da API key
  console.log('\n2️⃣ Validando formato da API Key...');

  if (!ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    console.log('⚠️  AVISO: API Key não começa com "sk-ant-"');
    console.log('   Formato esperado: sk-ant-api03-xxxxx');
  } else {
    console.log('✅ Formato válido');
  }

  // 3. Testar conexão com API
  console.log('\n3️⃣ Testando conexão com Anthropic API...');

  const testPrompt = `Você é um especialista em licitações.

Analise este título de documento: "Análise dos artigos 72 a 80 da Lei 14.133/2021"

Sugira 3 artigos relevantes da Lei 14.133/2021 (apenas números entre 1 e 193).

Responda APENAS com JSON:
[
  {"articleNumber": "X", "score": Y, "reason": "motivo"}
]`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: testPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ ERRO na API:', response.status);
      console.log('Detalhes:', errorText);

      if (response.status === 401) {
        console.log('\n💡 Solução: API Key inválida ou expirada');
        console.log('   1. Verifique se copiou a chave completa');
        console.log('   2. Gere nova chave em: https://console.anthropic.com/settings/keys');
      } else if (response.status === 429) {
        console.log('\n💡 Solução: Limite de requisições excedido');
        console.log('   Aguarde alguns segundos e tente novamente');
      } else if (response.status === 403) {
        console.log('\n💡 Solução: Créditos insuficientes');
        console.log('   Adicione créditos em: https://console.anthropic.com/settings/billing');
      }

      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ Conexão bem-sucedida!');

    // 4. Verificar resposta
    console.log('\n4️⃣ Verificando resposta da API...');

    const contentText = data.content?.[0]?.text || '';
    console.log('📄 Resposta:', contentText.substring(0, 200) + '...');

    // Tentar extrair JSON
    const jsonMatch = contentText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const suggestions = JSON.parse(jsonMatch[0]);
      console.log('✅ JSON válido encontrado');
      console.log('📊 Sugestões:', suggestions.length);

      suggestions.forEach((s, i) => {
        console.log(`   ${i + 1}. Art. ${s.articleNumber}º (score: ${s.score}) - ${s.reason}`);
      });
    } else {
      console.log('⚠️  AVISO: Resposta não contém JSON esperado');
    }

    // 5. Informações de uso
    console.log('\n5️⃣ Informações de uso:');
    console.log('📥 Tokens input:', data.usage?.input_tokens || 'N/A');
    console.log('📤 Tokens output:', data.usage?.output_tokens || 'N/A');

    const totalTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    const estimatedCost = (totalTokens / 1000000) * 0.25; // Haiku input pricing

    console.log('💰 Custo estimado desta chamada: ~$' + estimatedCost.toFixed(6));

    // Sucesso!
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUCESSO! Claude API está configurada e funcionando!');
    console.log('='.repeat(60));
    console.log('\n✅ Próximos passos:');
    console.log('   1. Acesse: http://localhost:3000/admin/documentos');
    console.log('   2. Clique em "Sugerir Artigos Automaticamente"');
    console.log('   3. Teste com um documento ou apenas título/descrição');
    console.log('   4. Veja sugestões com badge 🤖 IA\n');

  } catch (error) {
    console.log('❌ ERRO ao chamar API:', error.message);
    console.log('\n💡 Possíveis causas:');
    console.log('   - Problema de conexão com internet');
    console.log('   - Firewall bloqueando acesso à api.anthropic.com');
    console.log('   - API da Anthropic temporariamente fora do ar');
    process.exit(1);
  }
}

// Executar teste
testClaudeAPI().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
