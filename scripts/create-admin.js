/**
 * Script para criar usuário administrador
 *
 * Uso:
 *   node scripts/create-admin.js <email> <senha> <nome>
 *
 * Exemplo:
 *   node scripts/create-admin.js admin@profbarral.com.br SenhaSegura123 "Prof. Daniel Barral"
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('\n❌ Uso incorreto!');
    console.log('\n📝 Uso correto:');
    console.log('   node scripts/create-admin.js <email> <senha> <nome>\n');
    console.log('📌 Exemplo:');
    console.log('   node scripts/create-admin.js admin@profbarral.com.br SenhaSegura123 "Prof. Daniel Barral"\n');
    process.exit(1);
  }

  const [email, password, name] = args;

  console.log('\n🔐 Criando usuário administrador...\n');
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Nome: ${name}`);
  console.log(`🔑 Senha: ${'*'.repeat(password.length)}\n`);

  try {
    // Verificar se já existe
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      console.error(`❌ Erro: Já existe um usuário com o email ${email}\n`);
      process.exit(1);
    }

    // Criar hash da senha
    console.log('🔒 Gerando hash da senha...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Criar usuário
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

  } catch (error) {
    console.error('\n❌ Erro ao criar usuário:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
