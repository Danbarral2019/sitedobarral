#!/usr/bin/env node

/**
 * Script para configurar Instagram API
 *
 * Uso:
 *   node scripts/setup-instagram.js
 *
 * O script vai pedir as credenciais e:
 * 1. Trocar token curto por token de longa duração
 * 2. Obter o Instagram Business Account ID
 * 3. Atualizar o arquivo .env.local
 */

const readline = require('readline');
const https = require('https');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Erro ao parsear resposta: ' + data));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   📱 Configuração do Instagram API - Prof. Daniel Barral  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Coletar credenciais
  console.log('📋 Passo 1: Coletar credenciais do Facebook App');
  console.log('');

  const appId = await question('App ID (da página Configurações > Básico): ');
  const appSecret = await question('App Secret (clique em "Mostrar"): ');
  const shortToken = await question('Token de Acesso (do Graph API Explorer): ');

  console.log('');
  console.log('🔄 Passo 2: Trocando por token de longa duração...');

  try {
    // Trocar por token de longa duração
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;

    const tokenResponse = await httpsGet(tokenUrl);

    if (tokenResponse.error) {
      throw new Error(tokenResponse.error.message);
    }

    const longToken = tokenResponse.access_token;
    console.log('✅ Token de longa duração obtido!');
    console.log('   Expira em:', tokenResponse.expires_in ? `${tokenResponse.expires_in / 86400} dias` : '60 dias');
    console.log('');

    // Obter Page ID
    console.log('🔄 Passo 3: Obtendo informações da Página do Facebook...');
    const accountsUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${longToken}`;
    const accountsResponse = await httpsGet(accountsUrl);

    if (!accountsResponse.data || accountsResponse.data.length === 0) {
      throw new Error('Nenhuma página do Facebook encontrada. Certifique-se de ter uma página conectada.');
    }

    const page = accountsResponse.data[0];
    console.log('✅ Página encontrada:', page.name);
    console.log('   Page ID:', page.id);
    console.log('');

    // Obter Instagram Business Account ID
    console.log('🔄 Passo 4: Obtendo Instagram Business Account ID...');
    const igUrl = `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${longToken}`;
    const igResponse = await httpsGet(igUrl);

    if (!igResponse.instagram_business_account) {
      throw new Error('Instagram Business Account não encontrado. Certifique-se de ter conectado o Instagram à Página do Facebook.');
    }

    const igAccountId = igResponse.instagram_business_account.id;
    console.log('✅ Instagram Business Account ID obtido!');
    console.log('   ID:', igAccountId);
    console.log('');

    // Atualizar .env.local
    console.log('🔄 Passo 5: Atualizando .env.local...');
    const envPath = path.join(__dirname, '..', '.env.local');

    if (!fs.existsSync(envPath)) {
      console.log('⚠️  Arquivo .env.local não encontrado. Criando novo arquivo...');
      fs.copyFileSync(path.join(__dirname, '..', '.env.example'), envPath);
    }

    let envContent = fs.readFileSync(envPath, 'utf8');

    // Substituir ou adicionar variáveis
    const updates = {
      'INSTAGRAM_ACCESS_TOKEN': longToken,
      'INSTAGRAM_BUSINESS_ACCOUNT_ID': igAccountId,
    };

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Arquivo .env.local atualizado!');
    console.log('');

    // Sucesso!
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║               ✅ CONFIGURAÇÃO CONCLUÍDA! ✅                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 Credenciais configuradas:');
    console.log('   ✅ INSTAGRAM_ACCESS_TOKEN');
    console.log('   ✅ INSTAGRAM_BUSINESS_ACCOUNT_ID');
    console.log('');
    console.log('🚀 Próximos passos:');
    console.log('   1. Reinicie o servidor de desenvolvimento: npm run dev');
    console.log('   2. Acesse: http://localhost:3000/admin/blog');
    console.log('   3. Crie um novo post e marque "Publicar nas redes sociais"');
    console.log('   4. Verifique em: http://localhost:3000/admin/redes-sociais');
    console.log('');
    console.log('⏰ LEMBRETE: Token expira em ~60 dias. Marque no calendário!');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ ERRO:', error.message);
    console.error('');
    console.error('💡 Dicas:');
    console.error('   - Verifique se o App ID e App Secret estão corretos');
    console.error('   - Confirme que o token foi gerado no Graph API Explorer');
    console.error('   - Certifique-se de ter adicionado todas as permissões:');
    console.error('     ✓ instagram_basic');
    console.error('     ✓ instagram_content_publish');
    console.error('     ✓ pages_read_engagement');
    console.error('     ✓ pages_show_list');
    console.error('');
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
