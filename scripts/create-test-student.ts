/**
 * Cria (ou atualiza) o aluno de teste e o matricula no primeiro curso do
 * catálogo (`data/courses.ts`), com validade de 1 ano.
 *
 * Uso:
 *   TEST_STUDENT_PASSWORD=... npx tsx scripts/create-test-student.ts
 *
 * A senha vem do ambiente (ou do .env.local) para não ficar no código.
 *
 * Para matriculá-lo em todos os cursos do catálogo, rodar em seguida
 * `scripts/enroll-test-user.ts`.
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { courses } from '../data/courses';

const EMAIL = 'aluno@teste.com';
const NAME = 'Aluno Teste';
const TURMA = 'Turma Teste 2025';

async function createTestStudent() {
  const password = process.env.TEST_STUDENT_PASSWORD;
  if (!password) {
    throw new Error('Defina TEST_STUDENT_PASSWORD com a senha do aluno de teste.');
  }
  const course = courses[0];
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  console.log('\n🎓 Criando aluno de teste...\n');
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`👤 Nome: ${NAME}`);
  console.log(`📚 Curso: [${course.id}] ${course.title}`);
  console.log(`🏫 Turma: ${TURMA}\n`);

  const passwordHash = await bcrypt.hash(password, 10);
  const existingStudent = await prisma.user.findUnique({ where: { email: EMAIL } });

  let student;
  if (existingStudent) {
    console.log('⚠️  Aluno já existe. Atualizando senha...\n');
    student = await prisma.user.update({
      where: { email: EMAIL },
      data: {
        passwordHash,
        emailVerified: true, // Marcar como verificado para facilitar login
      },
    });
  } else {
    student = await prisma.user.create({
      data: {
        email: EMAIL,
        name: NAME,
        passwordHash,
        role: 'student',
        emailVerified: true, // Marcar como verificado para facilitar login
      },
    });
    console.log('✅ Aluno criado com sucesso!\n');
  }

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
  });

  if (existingEnrollment) {
    console.log('⚠️  Matrícula já existe neste curso. Atualizando...\n');
    await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: { expiresAt, turma: TURMA },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        turma: TURMA,
        expiresAt,
        isLifetime: false,
      },
    });
    console.log('✅ Matrícula criada com sucesso!\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ALUNO DE TESTE CONFIGURADO COM SUCESSO!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔐 CREDENCIAIS DE ACESSO:');
  console.log(`   Email: ${EMAIL}`);
  console.log('   Senha: a de TEST_STUDENT_PASSWORD\n');
  console.log('🌐 ACESSO:');
  console.log('   Login: http://localhost:3000/login');
  console.log('   Área Restrita: http://localhost:3000/area-restrita\n');
  console.log('📚 CURSO MATRICULADO:');
  console.log(`   [${course.id}] ${course.title} - ${TURMA}`);
  console.log(`   Validade: 1 ano (até ${expiresAt.toLocaleDateString('pt-BR')})\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

createTestStudent()
  .catch((error) => {
    console.error('\n❌ Erro ao criar aluno de teste:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
