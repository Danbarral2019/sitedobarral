require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTestUser() {
  // Buscar usuário de teste
  const testUser = await prisma.user.findUnique({
    where: { email: 'aluno@teste.com' },
    include: {
      enrollments: true
    }
  });

  if (!testUser) {
    console.log('\n❌ Usuário aluno@teste.com NÃO ENCONTRADO!');
    console.log('   Crie o usuário de teste primeiro.');
    await prisma.$disconnect();
    return;
  }

  console.log('\n✅ Usuário de teste encontrado:');
  console.log('═'.repeat(70));
  console.log(`   Email: ${testUser.email}`);
  console.log(`   Nome: ${testUser.name}`);
  console.log(`   Role: ${testUser.role}`);
  console.log(`   Email verificado: ${testUser.emailVerified ? 'Sim' : 'Não'}`);

  console.log(`\n📚 Matrículas (${testUser.enrollments.length}):`);
  console.log('═'.repeat(70));

  if (testUser.enrollments.length === 0) {
    console.log('   ⚠️  NENHUMA MATRÍCULA ENCONTRADA!');
    console.log('   O usuário não está matriculado em nenhum curso.');
    console.log('\n   💡 Solução: Use um QR code para matricular o usuário:');
    console.log('      1. Acesse /admin');
    console.log('      2. Gere um QR code para um curso');
    console.log('      3. Use /validar-acesso com o código gerado');
  } else {
    testUser.enrollments.forEach((enrollment, i) => {
      console.log(`\n   ${i + 1}. Curso ${enrollment.courseId}`);
      console.log(`      Expira em: ${enrollment.expiresAt ? enrollment.expiresAt.toISOString().split('T')[0] : 'N/A'}`);
      console.log(`      Vitalício: ${enrollment.isLifetime ? 'Sim' : 'Não'}`);
      console.log(`      Turma: ${enrollment.turma || 'N/A'}`);

      // Verificar se já expirou
      if (enrollment.expiresAt && !enrollment.isLifetime) {
        const now = new Date();
        const expired = enrollment.expiresAt < now;
        if (expired) {
          console.log(`      ⚠️  EXPIRADO!`);
        } else {
          const daysLeft = Math.floor((enrollment.expiresAt - now) / (1000 * 60 * 60 * 24));
          console.log(`      ✅ Válido (${daysLeft} dias restantes)`);
        }
      }
    });

    // Verificar documentos disponíveis para os cursos matriculados
    const courseIds = testUser.enrollments.map(e => e.courseId);
    const docCount = await prisma.document.count({
      where: {
        courseId: { in: courseIds }
      }
    });

    const onCount = await prisma.document.count({
      where: {
        courseId: { in: courseIds },
        category: 'orientacao-normativa'
      }
    });

    console.log(`\n📊 Documentos disponíveis para os cursos matriculados:`);
    console.log(`   Total: ${docCount} documentos`);
    console.log(`   Orientações Normativas: ${onCount} documentos`);
  }

  await prisma.$disconnect();
}

checkTestUser();
