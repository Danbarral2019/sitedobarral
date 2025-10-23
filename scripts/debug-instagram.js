#!/usr/bin/env node

/**
 * Script de debug para verificar o que está acontecendo com o Instagram
 */

const readline = require('readline');
const https = require('https');

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
  console.log('🔍 Debug do Instagram API\n');

  const token = await question('Cole o token de acesso: ');
  console.log('\n=== VERIFICANDO INFORMAÇÕES ===\n');

  try {
    // 1. Verificar informações do usuário
    console.log('1️⃣ Informações do usuário:');
    const meUrl = `https://graph.facebook.com/v18.0/me?access_token=${token}`;
    const meData = await httpsGet(meUrl);
    console.log('   Nome:', meData.name);
    console.log('   ID:', meData.id);
    console.log('');

    // 2. Verificar páginas
    console.log('2️⃣ Buscando páginas do Facebook:');
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${token}`;
    const pagesData = await httpsGet(pagesUrl);

    if (pagesData.error) {
      console.log('   ❌ Erro:', pagesData.error.message);
      console.log('   Código:', pagesData.error.code);
      console.log('');
    } else if (pagesData.data && pagesData.data.length > 0) {
      console.log('   ✅ Páginas encontradas:', pagesData.data.length);
      pagesData.data.forEach((page, index) => {
        console.log(`   ${index + 1}. ${page.name} (ID: ${page.id})`);
      });
      console.log('');

      // 3. Verificar Instagram de cada página
      console.log('3️⃣ Verificando Instagram Business Account:');
      for (const page of pagesData.data) {
        const igUrl = `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${token}`;
        const igData = await httpsGet(igUrl);

        if (igData.instagram_business_account) {
          console.log(`   ✅ ${page.name}: ID ${igData.instagram_business_account.id}`);
        } else {
          console.log(`   ❌ ${page.name}: Instagram não conectado`);
        }
      }
      console.log('');
    } else {
      console.log('   ❌ Nenhuma página encontrada');
      console.log('   Resposta completa:', JSON.stringify(pagesData, null, 2));
      console.log('');
    }

    // 4. Verificar permissões do token
    console.log('4️⃣ Verificando permissões do token:');
    const permUrl = `https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`;
    const permData = await httpsGet(permUrl);

    if (permData.data) {
      const granted = permData.data.filter(p => p.status === 'granted');
      console.log('   Permissões concedidas:');
      granted.forEach(p => console.log(`   ✅ ${p.permission}`));

      const needed = ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement', 'pages_show_list'];
      const missing = needed.filter(n => !granted.find(g => g.permission === n));

      if (missing.length > 0) {
        console.log('\n   ⚠️  Permissões faltando:');
        missing.forEach(m => console.log(`   ❌ ${m}`));
      }
    }
    console.log('');

    console.log('═══════════════════════════════════════');
    console.log('💡 DIAGNÓSTICO:');
    console.log('═══════════════════════════════════════');

    if (!pagesData.data || pagesData.data.length === 0) {
      console.log('\n❌ PROBLEMA: Nenhuma página do Facebook encontrada\n');
      console.log('SOLUÇÕES:');
      console.log('1. Você tem uma Página do Facebook criada?');
      console.log('   Crie em: https://facebook.com/pages/create\n');
      console.log('2. Você é ADMINISTRADOR da página?');
      console.log('   Verifique em: https://facebook.com/pages\n');
      console.log('3. No Graph API Explorer:');
      console.log('   - Mude de "User Token" para "Page Token"');
      console.log('   - Selecione sua página');
      console.log('   - Gere um novo token\n');
    }

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  } finally {
    rl.close();
  }
}

main();
