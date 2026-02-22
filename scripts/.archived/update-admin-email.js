/**
 * Script para atualizar o email do administrador
 *
 * Uso: node scripts/update-admin-email.js
 */

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAdminEmail() {
  try {
    console.log('🔍 Procurando usuário admin...');

    // Buscar o usuário admin atual
    const oldEmail = 'Admin@profdanielbarral.com';
    const newEmail = 'admin@profdanielbarral.com';

    const admin = await prisma.user.findUnique({
      where: { email: oldEmail },
    });

    if (!admin) {
      console.log('❌ Usuário admin não encontrado com o email:', oldEmail);
      console.log('');
      console.log('Verificando se já existe com o novo email...');

      const existingAdmin = await prisma.user.findUnique({
        where: { email: newEmail },
      });

      if (existingAdmin) {
        console.log('✅ Admin já existe com o novo email:', newEmail);
        console.log('   ID:', existingAdmin.id);
        console.log('   Nome:', existingAdmin.name);
        console.log('   Role:', existingAdmin.role);
      } else {
        console.log('❌ Nenhum admin encontrado.');
      }

      return;
    }

    console.log('✅ Usuário encontrado:');
    console.log('   ID:', admin.id);
    console.log('   Email atual:', admin.email);
    console.log('   Nome:', admin.name);
    console.log('   Role:', admin.role);
    console.log('');

    // Verificar se o novo email já existe
    const emailExists = await prisma.user.findUnique({
      where: { email: newEmail },
    });

    if (emailExists && emailExists.id !== admin.id) {
      console.log('❌ Erro: Já existe outro usuário com o email:', newEmail);
      return;
    }

    console.log('🔄 Atualizando email...');

    // Atualizar o email
    const updatedAdmin = await prisma.user.update({
      where: { id: admin.id },
      data: { email: newEmail },
    });

    console.log('✅ Email atualizado com sucesso!');
    console.log('   Email antigo:', oldEmail);
    console.log('   Email novo:', updatedAdmin.email);
    console.log('');
    console.log('🎉 Pronto! Agora você pode fazer login com:', newEmail);

  } catch (error) {
    console.error('❌ Erro ao atualizar email:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
updateAdminEmail();
