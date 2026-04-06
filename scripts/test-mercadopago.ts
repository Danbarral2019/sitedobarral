/**
 * Script de validacao das credenciais do Mercado Pago
 * Testa conexao com a API e cria uma preferencia de teste
 *
 * Uso: npx tsx scripts/test-mercadopago.ts
 */

import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Carregar .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

async function main() {
  console.log('=== Teste de Credenciais Mercado Pago ===\n');

  // 1. Verificar variaveis de ambiente
  console.log('1. Verificando variaveis de ambiente...');

  if (!accessToken) {
    console.error('   ERRO: MERCADOPAGO_ACCESS_TOKEN nao configurado');
    console.error('   Adicione ao .env.local: MERCADOPAGO_ACCESS_TOKEN=TEST-...');
    process.exit(1);
  }

  const isSandbox = accessToken.startsWith('TEST-');
  console.log(`   Access Token: ${accessToken.substring(0, 15)}... (${isSandbox ? 'SANDBOX' : 'PRODUCAO'})`);

  if (publicKey) {
    console.log(`   Public Key: ${publicKey.substring(0, 15)}...`);
  } else {
    console.log('   Public Key: nao configurado (opcional para backend)');
  }

  if (webhookSecret) {
    console.log(`   Webhook Secret: ${webhookSecret.substring(0, 10)}...`);
  } else {
    console.log('   Webhook Secret: nao configurado (HMAC sera ignorado)');
  }

  console.log('');

  // 2. Testar conexao criando preferencia
  console.log('2. Testando conexao com API do Mercado Pago...');

  const client = new MercadoPagoConfig({ accessToken });

  try {
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [{
          id: 'test-item',
          title: 'Teste de Conexao - Prof. Daniel Barral',
          description: 'Este item e apenas para teste de credenciais',
          quantity: 1,
          unit_price: 1.00,
          currency_id: 'BRL',
        }],
        payer: {
          email: 'test_user@testuser.com',
        },
        back_urls: {
          success: 'https://www.profdanielbarral.com/assinatura/sucesso',
          failure: 'https://www.profdanielbarral.com/assinatura/cancelado',
          pending: 'https://www.profdanielbarral.com/assinatura/pendente',
        },
        auto_return: 'approved',
        external_reference: JSON.stringify({ test: true }),
      },
    });

    console.log('   Preferencia criada com sucesso!');
    console.log(`   ID: ${result.id}`);
    console.log(`   Init Point: ${result.init_point}`);
    if (result.sandbox_init_point) {
      console.log(`   Sandbox Init Point: ${result.sandbox_init_point}`);
    }
    console.log('');
  } catch (error: any) {
    console.error('   ERRO ao criar preferencia:', error.message);
    if (error.status === 401) {
      console.error('   Access Token invalido ou expirado. Verifique suas credenciais.');
    }
    process.exit(1);
  }

  // 3. Testar criacao de pagamento PIX
  console.log('3. Testando criacao de pagamento PIX...');

  try {
    const payment = new Payment(client);
    const result = await payment.create({
      body: {
        transaction_amount: 1.00,
        description: 'Teste PIX - Prof. Daniel Barral',
        payment_method_id: 'pix',
        payer: {
          email: 'test_user@testuser.com',
          first_name: 'Test',
          last_name: 'User',
        },
        external_reference: JSON.stringify({ test: true }),
      },
    });

    const qrCode = result.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64;

    console.log('   Pagamento PIX criado com sucesso!');
    console.log(`   Payment ID: ${result.id}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   QR Code: ${qrCode ? 'Gerado (' + qrCode.substring(0, 30) + '...)' : 'Nao disponivel'}`);
    console.log(`   QR Code Base64: ${qrCodeBase64 ? 'Gerado (imagem)' : 'Nao disponivel'}`);
    console.log('');
  } catch (error: any) {
    console.error('   ERRO ao criar pagamento PIX:', error.message);
    if (error.cause) {
      console.error('   Detalhes:', JSON.stringify(error.cause, null, 2));
    }
    // PIX pode falhar em sandbox dependendo da config - nao e fatal
    console.log('   (PIX pode nao funcionar em sandbox para todos os usuarios de teste)');
    console.log('');
  }

  // 4. Resumo
  console.log('=== Resumo ===');
  console.log(`Ambiente: ${isSandbox ? 'SANDBOX (teste)' : 'PRODUCAO'}`);
  console.log('Checkout (Cartao/Boleto): OK');
  console.log('Webhook: Endpoint em /api/pagamento/webhook');
  console.log('');

  if (isSandbox) {
    console.log('Proximos passos:');
    console.log('1. Abra o Init Point no navegador para testar o checkout');
    console.log('2. Use cartoes de teste do MP: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards');
    console.log('3. Configure o webhook no painel MP para testar IPN');
    console.log('4. Quando tudo funcionar, migre para credenciais de producao');
  } else {
    console.log('ATENCAO: Voce esta usando credenciais de PRODUCAO!');
    console.log('Pagamentos reais serao processados.');
  }
}

main().catch(console.error);
