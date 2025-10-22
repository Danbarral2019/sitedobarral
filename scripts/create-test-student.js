import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestStudent() {
  const email = 'aluno@teste.com';
  const password = 'aluno123';
  const name = 'Aluno Teste';

  // Cursos disponíveis (pegue um curso válido de data/courses.ts)
  const courseId = 'nova-lei-licitacoes'; // Lei 14.133/2021
  const turma = 'Turma Teste 2025';

  try {
    console.log('\n🎓 Criando aluno de teste...\n');
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Nome: ${name}`);
    console.log(`🔑 Senha: ${password}`);
    console.log(`📚 Curso: ${courseId}`);
    console.log(`🏫 Turma: ${turma}\n`);

    // Verificar se o aluno já existe
    const existingStudent = await prisma.user.findUnique({
      where: { email },
    });

    let student;

    if (existingStudent) {
      console.log('⚠️  Aluno já existe. Atualizando senha...\n');
      const passwordHash = await bcrypt.hash(password, 10);

      student = await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          emailVerified: true, // Marcar como verificado para facilitar login
        },
      });
    } else {
      // Criar o aluno
      const passwordHash = await bcrypt.hash(password, 10);

      student = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: 'student',
          emailVerified: true, // Marcar como verificado para facilitar login
        },
      });

      console.log('✅ Aluno criado com sucesso!\n');
    }

    // Verificar se já existe matrícula neste curso
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: student.id,
          courseId: courseId,
        },
      },
    });

    if (existingEnrollment) {
      console.log('⚠️  Matrícula já existe neste curso. Atualizando...\n');

      // Atualizar para garantir acesso válido
      await prisma.enrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano a partir de agora
          turma: turma,
        },
      });
    } else {
      // Criar matrícula
      await prisma.enrollment.create({
        data: {
          userId: student.id,
          courseId: courseId,
          turma: turma,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
          isLifetime: false,
        },
      });

      console.log('✅ Matrícula criada com sucesso!\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALUNO DE TESTE CONFIGURADO COM SUCESSO!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔐 CREDENCIAIS DE ACESSO:');
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}\n`);
    console.log('🌐 ACESSO:');
    console.log('   Login: http://localhost:3001/login');
    console.log('   Área Restrita: http://localhost:3001/area-restrita\n');
    console.log('📚 CURSO MATRICULADO:');
    console.log(`   ${courseId} - ${turma}`);
    console.log(`   Validade: 1 ano (até ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')})\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Erro ao criar aluno de teste:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestStudent();
