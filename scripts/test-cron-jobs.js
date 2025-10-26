/**
 * Script de Teste dos Cron Jobs
 *
 * Testa manualmente os endpoints de automação sem precisar esperar pelo agendamento.
 *
 * Uso:
 * node scripts/test-cron-jobs.js import       # Testa importação de documentos
 * node scripts/test-cron-jobs.js newsletter   # Testa envio de newsletter
 * node scripts/test-cron-jobs.js all          # Testa todos
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ Erro: CRON_SECRET não configurado no .env.local');
  process.exit(1);
}

async function testImportDocuments() {
  console.log('\n📥 Testando importação automática de documentos...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/cron/import-documents`, {
      method: 'GET',
      headers: {
        'x-cron-secret': CRON_SECRET,
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Importação executada com sucesso!');
      console.log('\n📊 Resultados:');
      console.log(`   TCU: ${data.results.tcu.count} novos documentos`);
      console.log(`   AGU: ${data.results.agu.count} novas ONs`);

      if (data.results.tcu.error) {
        console.log(`   ⚠️  Erro TCU: ${data.results.tcu.error}`);
      }
      if (data.results.agu.error) {
        console.log(`   ⚠️  Erro AGU: ${data.results.agu.error}`);
      }
    } else {
      console.error('❌ Erro na importação:', data.error);
    }

    console.log('\n📋 Resposta completa:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Erro ao testar importação:', error.message);
  }
}

async function testMonthlyNewsletter() {
  console.log('\n📧 Testando newsletter mensal...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/cron/monthly-newsletter`, {
      method: 'GET',
      headers: {
        'x-cron-secret': CRON_SECRET,
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Newsletter enviada com sucesso!');

      if (data.stats) {
        console.log('\n📊 Estatísticas:');
        console.log(`   Documentos novos: ${data.stats.documents}`);
        console.log(`   Inscritos: ${data.stats.subscribers}`);
        console.log(`   Emails enviados: ${data.stats.emailsSent}`);
        console.log(`   Emails falharam: ${data.stats.emailsFailed}`);
      }
    } else {
      console.error('❌ Erro no envio da newsletter:', data.error);
    }

    console.log('\n📋 Resposta completa:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Erro ao testar newsletter:', error.message);
  }
}

// Main
const command = process.argv[2];

async function main() {
  console.log('🧪 Teste de Cron Jobs - Prof. Daniel Barral');
  console.log('===========================================');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`🔑 CRON_SECRET: ${CRON_SECRET ? '✅ Configurado' : '❌ Não configurado'}`);

  switch (command) {
    case 'import':
      await testImportDocuments();
      break;

    case 'newsletter':
      await testMonthlyNewsletter();
      break;

    case 'all':
      await testImportDocuments();
      console.log('\n' + '='.repeat(50) + '\n');
      await testMonthlyNewsletter();
      break;

    default:
      console.log('\n❌ Comando inválido!\n');
      console.log('Uso:');
      console.log('  node scripts/test-cron-jobs.js import       # Testa importação');
      console.log('  node scripts/test-cron-jobs.js newsletter   # Testa newsletter');
      console.log('  node scripts/test-cron-jobs.js all          # Testa todos');
      process.exit(1);
  }

  console.log('\n✨ Teste concluído!\n');
}

main().catch(console.error);
