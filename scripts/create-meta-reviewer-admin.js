const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createMetaReviewerAdmin() {
  const email = 'admin@profdanielbarral.com';
  const password = 'MetaReview2024!Instagram'; // Senha temporária para revisores
  const name = 'Meta Reviewer (Temporary)';

  try {
    // Verificar se já existe
    const existing = await prisma.user.findUnique({ where: { email } });
    
    if (existing) {
      console.log('❌ Usuário já existe:', email);
      console.log('Use o script reset-admin-password.js para redefinir a senha');
      return;
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Criar admin temporário
    const admin = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'admin',
        emailVerified: true, // Já verificado para facilitar teste
      },
    });

    console.log('✅ Admin temporário criado com sucesso!');
    console.log('');
    console.log('📋 CREDENCIAIS PARA O FORMULÁRIO DA META:');
    console.log('═══════════════════════════════════════════');
    console.log('Email:', email);
    console.log('Senha:', password);
    console.log('');
    console.log('⚠️  LEMBRE-SE:');
    console.log('1. Copie estas credenciais para o formulário da Meta');
    console.log('2. Após aprovação, delete este usuário por segurança');
    console.log('3. Use: node scripts/delete-user.js', email);
    console.log('');
  } catch (error) {
    console.error('❌ Erro ao criar admin:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createMetaReviewerAdmin();
