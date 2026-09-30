/**
 * Script para criar usuário administrador
 *
 * Uso:
 *   npx tsx scripts/create-admin.ts <email> <senha> <nome>
 *
 * Exemplo:
 *   npx tsx scripts/create-admin.ts admin@profbarral.com.br '<senha>' "Prof. Daniel Barral"
 *
 * O banco é o da DATABASE_URL do ambiente ou, na falta dela, do .env.local
 * (ver lib/prisma.ts).
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

const USO = 'npx tsx scripts/create-admin.ts <email> <senha> <nome>';

async function createAdmin() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('\n❌ Uso incorreto!');
    console.log('\n📝 Uso correto:');
    console.log(`   ${USO}\n`);
    console.log('📌 Exemplo:');
    console.log(`   npx tsx scripts/create-admin.ts admin@profbarral.com.br '<senha>' "Prof. Daniel Barral"\n`);
    process.exitCode = 1;
    return;
  }

  const [email, password, name] = args;

  console.log('\n🔐 Criando usuário administrador...\n');
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Nome: ${name}`);
  console.log(`🔑 Senha: ${'*'.repeat(password.length)}\n`);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`❌ Erro: Já existe um usuário com o email ${email}\n`);
    process.exitCode = 1;
    return;
  }

  console.log('🔒 Gerando hash da senha...');
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('💾 Salvando no banco de dados...');
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'admin',
      emailVerified: true, // Admin não precisa verificar email
    },
  });

  console.log('\n✅ Usuário administrador criado com sucesso!\n');
  console.log('📋 Detalhes:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Nome: ${user.name}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Criado em: ${user.createdAt.toLocaleString('pt-BR')}\n`);
  console.log('🎉 Agora você pode fazer login no sistema!\n');
}

createAdmin()
  .catch((error) => {
    console.error('\n❌ Erro ao criar usuário:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
