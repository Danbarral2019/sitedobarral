/**
 * Script para resetar a senha do administrador
 *
 * Uso: node scripts/reset-admin-password.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function resetAdminPassword() {
  try {
    console.log('🔐 Reset de Senha do Administrador\n');

    const adminEmail = 'admin@profdanielbarral.com';

    // Buscar admin
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!admin) {
      console.log('❌ Admin não encontrado com email:', adminEmail);
      return;
    }

    console.log('✅ Admin encontrado:');
    console.log('   Nome:', admin.name);
    console.log('   Email:', admin.email);
    console.log('');

    // Solicitar nova senha
    const newPassword = await question('Digite a nova senha (mínimo 8 caracteres): ');

    if (newPassword.length < 8) {
      console.log('❌ Senha muito curta. Mínimo de 8 caracteres.');
      return;
    }

    const confirmPassword = await question('Confirme a nova senha: ');

    if (newPassword !== confirmPassword) {
      console.log('❌ As senhas não conferem.');
      return;
    }

    console.log('');
    console.log('🔄 Gerando hash da senha...');

    // Gerar hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar no banco
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    console.log('✅ Senha resetada com sucesso!');
    console.log('');
    console.log('🎉 Agora você pode fazer login com:');
    console.log('   Email:', adminEmail);
    console.log('   Senha: [a senha que você acabou de definir]');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

resetAdminPassword();
