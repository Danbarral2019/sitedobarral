/**
 * Lista os usuários administradores.
 *
 * Uso:
 *   npx tsx scripts/list-admins.ts
 *
 * O banco é o da DATABASE_URL do ambiente ou, na falta dela, do .env.local
 * (ver lib/prisma.ts).
 */

import { prisma } from '../lib/prisma';

async function listAdmins() {
  console.log('🔍 Buscando todos os usuários admin...\n');

  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  if (admins.length === 0) {
    console.log('❌ Nenhum usuário admin encontrado no banco de dados.\n');
    console.log('💡 Você precisa criar um admin primeiro.');
    console.log(`   Use: npx tsx scripts/create-admin.ts email@exemplo.com '<senha>' "Nome Completo"`);
    return;
  }

  console.log(`✅ Encontrados ${admins.length} admin(s):\n`);
  admins.forEach((admin, index) => {
    console.log(`${index + 1}. ${admin.name}`);
    console.log(`   ID: ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Criado em: ${admin.createdAt.toLocaleString('pt-BR')}`);
    console.log('');
  });
}

listAdmins()
  .catch((error) => {
    console.error('❌ Erro:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
