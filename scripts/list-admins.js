/**
 * Script para listar todos os usuários admin
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listAdmins() {
  try {
    console.log('🔍 Buscando todos os usuários admin...\n');

    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    if (admins.length === 0) {
      console.log('❌ Nenhum usuário admin encontrado no banco de dados.');
      console.log('');
      console.log('💡 Você precisa criar um admin primeiro.');
      console.log('   Use: node scripts/create-admin.js email@exemplo.com SenhaSegura "Nome Completo"');
    } else {
      console.log(`✅ Encontrados ${admins.length} admin(s):\n`);
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.name}`);
        console.log(`   ID: ${admin.id}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Criado em: ${admin.createdAt}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listAdmins();
