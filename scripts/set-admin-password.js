/**
 * Script para definir senha do administrador
 *
 * Uso: node scripts/set-admin-password.js "SuaNovaSenha"
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setAdminPassword() {
  try {
    const newPassword = process.argv[2];

    if (!newPassword) {
      console.log('❌ Uso: node scripts/set-admin-password.js "SuaNovaSenha"');
      console.log('   Exemplo: node scripts/set-admin-password.js "MinhaS3nh@Forte!"');
      return;
    }

    if (newPassword.length < 8) {
      console.log('❌ Senha muito curta. Mínimo de 8 caracteres.');
      return;
    }

    console.log('🔐 Definindo senha do administrador...\n');

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
    console.log('🔄 Gerando hash da senha...');

    // Gerar hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar no banco
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    console.log('✅ Senha definida com sucesso!\n');
    console.log('🎉 Credenciais do Admin:');
    console.log('   Email: ' + adminEmail);
    console.log('   Senha: [a senha que você definiu]');
    console.log('');
    console.log('Agora você pode fazer login no site!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

setAdminPassword();
