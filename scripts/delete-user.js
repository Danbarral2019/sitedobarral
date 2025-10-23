const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteUser() {
  const email = process.argv[2];

  if (!email) {
    console.log('❌ Uso: node scripts/delete-user.js <email>');
    console.log('Exemplo: node scripts/delete-user.js admin@profdanielbarral.com');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      console.log('❌ Usuário não encontrado:', email);
      return;
    }

    await prisma.user.delete({ where: { email } });
    console.log('✅ Usuário deletado com sucesso:', email);
  } catch (error) {
    console.error('❌ Erro ao deletar usuário:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUser();
